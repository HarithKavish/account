import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db/client';

/**
 * Sessions — owned by the authentication half (contract §0.5).
 *
 * Opaque and server-side rather than a signed token. Revocation is then a
 * DELETE rather than a key rotation and a denylist, and first-party SSO gains
 * nothing from a self-describing token it cannot withdraw.
 *
 * The cookie carries a random token; only its SHA-256 is stored. A database
 * leak must not hand over live sessions. SHA-256 rather than Argon2id because
 * the token already has 256 bits of entropy — there is nothing to slow down.
 */

/**
 * `__Host-` (V4): host-only, path `/`, Secure. It cannot be set for a parent
 * domain, so no subdomain can plant or read this session — which is exactly why
 * the ecosystem's shared display cookie is a separate, deliberately
 * unauthenticated thing.
 */
const COOKIE = '__Host-hk_session';

/** Long enough to be usable, short enough that an abandoned browser expires. */
const LIFETIME_DAYS = 30;
/** Rewritten at most daily, so a live session does not write on every request. */
const TOUCH_AFTER_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionUser {
  userId: string;
}

/** Establish a session and set the cookie. */
export async function createSession(userId: string, userAgent: string | null): Promise<void> {
  const db = getDb();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + LIFETIME_DAYS * 86_400_000);

  await db.insert(schema.sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    userAgent: userAgent?.slice(0, 200) ?? null,
  });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/**
 * Who is signed in, verified against the store.
 *
 * Every call is a lookup. That is the cost of being able to revoke, and it is
 * the reason a session can be ended from another device and mean it.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.sessions)
    .where(and(eq(schema.sessions.tokenHash, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);

  const session = rows[0];
  if (!session) return null;

  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
    await db
      .update(schema.sessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(schema.sessions.id, session.id));
  }

  return { userId: session.userId };
}

/** End this browser's session. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;

  if (token) {
    const db = getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, hashToken(token)));
  }

  /*
   * Overwritten rather than deleted.
   *
   * A `__Host-` cookie can only be replaced by one carrying the same
   * attributes — Secure, Path=/, host-only. A bare delete omits them, the
   * browser rejects the replacement, and the old cookie stays: the session is
   * gone from the database, but the browser keeps presenting a dead token
   * forever.
   */
  jar.set(COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * End every session for an account.
 *
 * What `credentials_changed_at` is for (§4): unlinking a provider removes a way
 * in, and a session established through it must not outlive it.
 */
export async function destroyAllSessions(userId: string): Promise<void> {
  const db = getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}
