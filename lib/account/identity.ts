import 'server-only';

import { randomBytes } from 'node:crypto';

import { and, eq, isNull } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db/client';
import { generateRecoveryCodes, normalizeRecoveryCode, recoveryCodeMatches } from './recovery';
import { hashPassword, verifyPassword } from './password';
import type { AccountProfile, ResolvedIdentity, Result, VerifiedProviderIdentity } from './types';

/**
 * The account half's operations for federated identity and recovery.
 *
 * This is the boundary the authentication half calls through — the contract's
 * §5.10 and §5.9, as function calls rather than HTTP because the halves share a
 * deployable (§0.5). Nothing in `lib/auth` touches these tables directly. §15
 * names the first query that does as the point where separating the halves
 * again stops being a refactor.
 */

/**
 * A real Argon2id hash of a value nobody holds, so a miss costs a verification
 * rather than a parse failure.
 *
 * It has to be genuine: `verifyPassword` returns false on a malformed hash
 * without doing the work, which would make "no such account" measurably faster
 * than "wrong password" — the exact oracle the uniform verdict exists to close.
 *
 * Computed once, on first need, from a value that never leaves this process.
 */
let dummyHash: Promise<string> | null = null;

function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(32).toString('base64'));
  return dummyHash;
}

function toProfile(row: typeof schema.users.$inferSelect): AccountProfile {
  return {
    id: row.id,
    userId: row.userId ?? null,
    firstName: row.firstName,
    lastName: row.lastName,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** A provider gives one display name; the account stores two. */
function splitName(name: string | null, email: string | null): { first: string; last: string } {
  const source = (name ?? '').trim();
  if (source) {
    const parts = source.split(/\s+/);
    return { first: parts[0], last: parts.slice(1).join(' ') || parts[0] };
  }
  // No name asserted. The local part of the address is a better placeholder than
  // an empty string, and the person can correct it.
  const local = (email ?? '').split('@')[0] || 'Account';
  return { first: local, last: local };
}

/**
 * §5.10 — exchange a verified provider subject for the account it belongs to,
 * creating one if the subject is new.
 *
 * Idempotent on `(issuer, subject)`: a repeat returns the same account and
 * creates nothing.
 *
 * `email` is carried for display and audit. It is **never** a lookup key (V27):
 * resolving an account by a provider-asserted address would make any provider
 * willing to verify one an account-takeover path.
 */
export async function resolveFederatedIdentity(
  identity: VerifiedProviderIdentity,
): Promise<Result<ResolvedIdentity>> {
  const db = getDb();

  try {
    const existing = await db
      .select()
      .from(schema.userIdentities)
      .where(
        and(
          eq(schema.userIdentities.issuer, identity.issuer),
          eq(schema.userIdentities.subject, identity.subject),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const link = existing[0];
      const rows = await db.select().from(schema.users).where(eq(schema.users.id, link.userId)).limit(1);
      const user = rows[0];

      // V19: `deleted` must not authenticate. Refusing rather than creating a
      // fresh account is the only behaviour that cannot silently resurrect
      // someone who asked to be gone — X33 decides whether that ever changes.
      if (!user || user.status === 'deleted') {
        return {
          ok: false,
          error: { code: 'account_unavailable', message: 'This account is no longer available.' },
        };
      }

      await db
        .update(schema.userIdentities)
        .set({ lastAuthenticatedAt: new Date() })
        .where(eq(schema.userIdentities.id, link.id));

      return { ok: true, data: { profile: toProfile(user), created: false } };
    }

    // New subject: a person the ecosystem has not met. Create the account and
    // the link together — the account is what the identity *is* (V24), and the
    // link is only how they reached it.
    const { first, last } = splitName(identity.name, identity.email);

    const inserted = await db
      .insert(schema.users)
      .values({
        // Neither credential column is written: no password, and no chosen
        // public identifier (§6.4). Nothing is invented on their behalf.
        firstName: first,
        lastName: last,
      })
      .returning();

    const user = inserted[0];

    await db.insert(schema.userIdentities).values({
      userId: user.id,
      issuer: identity.issuer,
      subject: identity.subject,
      emailAtLink: identity.emailVerified ? identity.email : null,
    });

    await db.insert(schema.accountEvents).values([
      { userId: user.id, type: 'account_created', metadata: { via: 'federated' } },
      { userId: user.id, type: 'identity_linked', metadata: { issuer: identity.issuer } },
    ]);

    return { ok: true, data: { profile: toProfile(user), created: true } };
  } catch {
    return {
      ok: false,
      error: { code: 'database_unavailable', message: 'Could not reach the account store.' },
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Recovery — §5.9, §7.5                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Replace this account's recovery codes and return the plaintext once.
 *
 * Issuing replaces rather than appends: a person who asks for new codes expects
 * the old printout to stop working, and leaving both live doubles the guessing
 * surface for no benefit.
 */
export async function issueRecoveryCodes(userId: string): Promise<Result<string[]>> {
  const db = getDb();
  try {
    const { plaintext, hashes } = await generateRecoveryCodes();

    await db.delete(schema.recoveryCodes).where(eq(schema.recoveryCodes.userId, userId));
    await db
      .insert(schema.recoveryCodes)
      .values(hashes.map((codeHash) => ({ userId, codeHash })));
    await db
      .insert(schema.accountEvents)
      .values({ userId, type: 'recovery_codes_generated', metadata: { count: plaintext.length } });

    return { ok: true, data: plaintext };
  } catch {
    return {
      ok: false,
      error: { code: 'database_unavailable', message: 'Could not issue recovery codes.' },
    };
  }
}

/** How many unused codes remain, so a person can be warned before they run out. */
export async function countUnusedRecoveryCodes(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.recoveryCodes)
    .where(and(eq(schema.recoveryCodes.userId, userId), isNull(schema.recoveryCodes.usedAt)));
  return rows.length;
}

/**
 * §5.9 — spend a recovery code.
 *
 * Every unused code is compared, because a hash cannot be looked up by its
 * plaintext. That is a fixed cost per attempt regardless of whether the code is
 * right, which is also what stops the timing from saying so.
 *
 * Single use: the code is spent the moment it matches, before anything is
 * returned, so two concurrent attempts cannot both succeed with it.
 */
export async function consumeRecoveryCode(
  userId: string,
  presented: string,
): Promise<boolean> {
  const db = getDb();
  const normalized = normalizeRecoveryCode(presented);
  if (!normalized) return false;

  const candidates = await db
    .select()
    .from(schema.recoveryCodes)
    .where(and(eq(schema.recoveryCodes.userId, userId), isNull(schema.recoveryCodes.usedAt)));

  for (const candidate of candidates) {
    if (await recoveryCodeMatches(candidate.codeHash, normalized)) {
      const spent = await db
        .update(schema.recoveryCodes)
        .set({ usedAt: new Date() })
        .where(and(eq(schema.recoveryCodes.id, candidate.id), isNull(schema.recoveryCodes.usedAt)))
        .returning();

      // Lost the race with a concurrent attempt using the same code.
      if (spent.length === 0) return false;

      await db.insert(schema.accountEvents).values({ userId, type: 'recovery_code_used' });
      return true;
    }
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Password verification — §5.2                                                */
/* -------------------------------------------------------------------------- */

/**
 * Verify a presented password.
 *
 * The negative verdict is uniform (X8). No such account, wrong password, a
 * `deleted` account, and an account with no password at all (§6.4) all return
 * the same `null`. Anything else is an oracle: "this account exists but has no
 * password" tells an attacker precisely which accounts to attack through their
 * provider instead.
 *
 * Equivalent work is done when nothing matches, so the timing does not say what
 * the response refuses to.
 */
export async function verifyAccountPassword(
  rawUserId: string,
  password: string,
): Promise<AccountProfile | null> {
  const db = getDb();
  const normalized = rawUserId.trim().toLowerCase();

  const rows = normalized
    ? await db.select().from(schema.users).where(eq(schema.users.userId, normalized)).limit(1)
    : [];

  const user = rows[0];

  // A fixed hash to compare against when there is nothing real to compare with.
  // Short-circuiting here would make timing an enumeration oracle regardless of
  // what the response body says.
  const hash = user?.passwordHash ?? (await dummyPasswordHash());
  const matched = await verifyPassword(hash, password);

  if (!user || !user.passwordHash || user.status === 'deleted' || !matched) return null;
  return toProfile(user);
}
