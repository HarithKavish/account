import 'server-only';

import { desc, gt, isNull, sql } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db/client';
import { isAuthenticator } from '@/lib/auth/issuers';

/**
 * The account table, as an operator sees it.
 *
 * A read-only view across both halves of the deployable — `users`,
 * `user_identities`, `recovery_codes` and `webauthn_credentials` from the
 * account half, `sessions` from the authentication half. §15 draws that line for
 * *behaviour*: the halves must not implement each other. An operator looking at
 * their own service is a third reader of both, and reads nothing either half
 * would not show the person it belongs to.
 *
 * What is never selected, at any point in this file: `password_hash`,
 * `code_hash`, `token_hash`, `public_key`, `credential_id`. Not filtered out
 * afterwards — never asked for. A row is assembled field by field for the same
 * reason `lib/account/service.ts` assembles its result that way: a column added
 * to the schema later must not be able to arrive in a response because nobody
 * remembered to exclude it.
 */

export interface AccountHolder {
  /** Internal identifier. Shown because an operator needs something to quote. */
  id: string;
  name: string;
  /** The public identifier, or null for someone who arrived via a provider. */
  userId: string | null;
  email: string | null;
  /** Whether a provider proved the address, rather than someone typing it. */
  emailVerified: boolean;
  /**
   * Addresses a provider has asserted for this account, where the account row
   * itself carries none.
   *
   * `proveEmail` writes `users.email` when a provider is connected, but the
   * ordinary federated sign-in path does not call it — so an account whose link
   * predates that function shows no address at all while a provider has in fact
   * proved one. Reporting "None" there is simply wrong, so the proof is read
   * from where it actually lives.
   */
  providerEmails: { issuer: string; email: string }[];
  status: 'active' | 'deletion_requested' | 'deleted';
  /** Where the account's picture comes from: `none`, `google`, `gravatar`. */
  pictureSource: string;
  /**
   * Whether a password is set — never the hash, and never anything derived from
   * it. It is the one thing about a credential an operator has any use for: it
   * says whether this person has a way in that does not depend on a provider.
   */
  hasPassword: boolean;
  /**
   * Providers this person can actually sign in with.
   *
   * Not every linked provider is one — see `lib/auth/issuers.ts`. Gravatar is
   * linked in the same table and can never sign anyone in.
   */
  authenticators: string[];
  /** Providers linked for something other than signing in. */
  connections: string[];
  /** How many passkeys are registered. */
  passkeys: number;
  /** Unspent recovery codes — the count that matters before a lockout. */
  recoveryCodes: number;
  /** Live, unexpired sessions. */
  sessions: number;
  createdAt: string;
  updatedAt: string;
  deletionRequestedAt: string | null;
  deletedAt: string | null;
}

export interface AccountsSummary {
  total: number;
  active: number;
  deletionRequested: number;
  deleted: number;
  /** Accounts whose address a provider has proved. */
  verified: number;
  /** Accounts that can sign in with a provider. A connection does not count. */
  federated: number;
  /** Accounts that can be signed into with a password. */
  withPassword: number;
  /** Accounts with at least one passkey. */
  withPasskey: number;
  /** Accounts with no unspent recovery code — one bad day from lockout. */
  withoutRecovery: number;
  /** Accounts holding at least one live session. */
  signedIn: number;
  /** Accounts created in the last 30 days. */
  newLast30Days: number;
}

export interface AccountsView {
  summary: AccountsSummary;
  accounts: AccountHolder[];
  /** When this was read, so a stale tab says so instead of looking current. */
  readAt: string;
}

/** `count(*)` arrives from the driver as a string; ask Postgres for an int. */
const countInt = sql<number>`count(*)::int`;

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export async function readAccounts(): Promise<AccountsView> {
  const db = getDb();
  const now = new Date();

  /*
   * Five small reads rather than one join.
   *
   * A join across four one-to-many tables multiplies rows and then has to be
   * de-duplicated in application code, which is where a count silently becomes
   * a product. Grouped counts cannot do that, and the account table is small
   * enough that the extra round trips cost nothing worth the risk.
   */
  const [people, identities, passkeys, recovery, sessions] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        userId: schema.users.userId,
        email: schema.users.email,
        emailVerifiedAt: schema.users.emailVerifiedAt,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        status: schema.users.status,
        pictureSource: schema.users.pictureSource,
        // Never the hash. Only whether one is set, which is what says how this
        // person can get in — the thing an operator actually needs to know.
        hasPassword: sql<boolean>`${schema.users.passwordHash} is not null`,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
        deletionRequestedAt: schema.users.deletionRequestedAt,
        deletedAt: schema.users.deletedAt,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt)),

    db
      .select({
        userId: schema.userIdentities.userId,
        issuer: schema.userIdentities.issuer,
        emailAtLink: schema.userIdentities.emailAtLink,
      })
      .from(schema.userIdentities),

    db
      .select({ userId: schema.webauthnCredentials.userId, total: countInt })
      .from(schema.webauthnCredentials)
      .groupBy(schema.webauthnCredentials.userId),

    db
      .select({ userId: schema.recoveryCodes.userId, total: countInt })
      .from(schema.recoveryCodes)
      .where(isNull(schema.recoveryCodes.usedAt))
      .groupBy(schema.recoveryCodes.userId),

    db
      .select({ userId: schema.sessions.userId, total: countInt })
      .from(schema.sessions)
      .where(gt(schema.sessions.expiresAt, now))
      .groupBy(schema.sessions.userId),
  ]);

  /*
   * Sorted into what each link can do, rather than lumped together. A link is
   * either a way in or a connection, and the schema does not say which.
   */
  const waysIn = new Map<string, string[]>();
  const connectedTo = new Map<string, string[]>();
  const assertedEmails = new Map<string, { issuer: string; email: string }[]>();

  for (const link of identities) {
    const bucket = isAuthenticator(link.issuer) ? waysIn : connectedTo;
    const list = bucket.get(link.userId) ?? [];
    if (!list.includes(link.issuer)) list.push(link.issuer);
    bucket.set(link.userId, list);

    // Only an authenticator's assertion is reported as an address. A connection
    // does not write one anyway — `linkProfileProvider` takes no email — so this
    // is a guard against a future provider that does.
    if (link.emailAtLink && isAuthenticator(link.issuer)) {
      const address = link.emailAtLink.trim().toLowerCase();
      const found = assertedEmails.get(link.userId) ?? [];
      if (!found.some((entry) => entry.email === address)) {
        found.push({ issuer: link.issuer, email: address });
      }
      assertedEmails.set(link.userId, found);
    }
  }

  const tally = (rows: { userId: string; total: number }[]) =>
    new Map(rows.map((row) => [row.userId, row.total]));

  const passkeyCount = tally(passkeys);
  const recoveryCount = tally(recovery);
  const sessionCount = tally(sessions);

  const accounts: AccountHolder[] = people.map((row) => ({
    id: row.id,
    name: `${row.firstName} ${row.lastName}`.trim(),
    userId: row.userId,
    email: row.email,
    emailVerified: row.emailVerifiedAt !== null,
    status: row.status,
    pictureSource: row.pictureSource,
    hasPassword: row.hasPassword,
    providerEmails: assertedEmails.get(row.id) ?? [],
    authenticators: waysIn.get(row.id) ?? [],
    connections: connectedTo.get(row.id) ?? [],
    passkeys: passkeyCount.get(row.id) ?? 0,
    recoveryCodes: recoveryCount.get(row.id) ?? 0,
    sessions: sessionCount.get(row.id) ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletionRequestedAt: iso(row.deletionRequestedAt),
    deletedAt: iso(row.deletedAt),
  }));

  const thirtyDaysAgo = now.getTime() - 30 * 86_400_000;
  const count = (predicate: (row: (typeof people)[number]) => boolean) =>
    people.filter(predicate).length;

  const summary: AccountsSummary = {
    total: people.length,
    active: count((row) => row.status === 'active'),
    deletionRequested: count((row) => row.status === 'deletion_requested'),
    deleted: count((row) => row.status === 'deleted'),
    verified: count(
      (row) => row.emailVerifiedAt !== null || (assertedEmails.get(row.id)?.length ?? 0) > 0,
    ),
    federated: count((row) => (waysIn.get(row.id)?.length ?? 0) > 0),
    withPassword: count((row) => row.hasPassword),
    withPasskey: count((row) => (passkeyCount.get(row.id) ?? 0) > 0),
    withoutRecovery: count((row) => (recoveryCount.get(row.id) ?? 0) === 0),
    signedIn: count((row) => (sessionCount.get(row.id) ?? 0) > 0),
    newLast30Days: count((row) => row.createdAt.getTime() >= thirtyDaysAgo),
  };

  return { summary, accounts, readAt: now.toISOString() };
}
