import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db/client';

/**
 * Codes and tokens for the first-party OAuth flow.
 *
 * Both are opaque random values, stored as SHA-256. There is nothing to slow an
 * attacker down with — the values already carry 256 bits — and what matters is
 * that a leaked database yields nothing usable.
 */

/** Long enough to complete a redirect, short enough to be useless if captured. */
const CODE_TTL_MS = 60_000;
/** Five minutes (V15). Spent once against /oauth/userinfo. */
const TOKEN_TTL_MS = 5 * 60_000;

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function issueCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
}): Promise<string> {
  const db = getDb();
  const code = randomBytes(32).toString('base64url');

  await db.insert(schema.oauthCodes).values({
    codeHash: hash(code),
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  return code;
}

/** S256 only. `plain` exists in the spec and is not worth supporting. */
function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Spend a code.
 *
 * Marked used before anything is returned and guarded by `used_at IS NULL`, so
 * two requests racing with the same code cannot both succeed — the second finds
 * nothing to update.
 */
export async function consumeCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ userId: string } | null> {
  const db = getDb();

  const rows = await db
    .select()
    .from(schema.oauthCodes)
    .where(eq(schema.oauthCodes.codeHash, hash(input.code)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  // Every one of these is part of what the code was issued for. A mismatch
  // means this is not the exchange the code was minted for.
  if (row.clientId !== input.clientId) return null;
  if (row.redirectUri !== input.redirectUri) return null;
  if (!constantTimeEquals(row.codeChallenge, challengeFor(input.codeVerifier))) return null;

  const spent = await db
    .update(schema.oauthCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.oauthCodes.id, row.id), isNull(schema.oauthCodes.usedAt)))
    .returning();

  if (spent.length === 0) return null;

  return { userId: row.userId };
}

export async function issueToken(clientId: string, userId: string): Promise<{
  token: string;
  expiresInSeconds: number;
}> {
  const db = getDb();
  const token = randomBytes(32).toString('base64url');

  await db.insert(schema.oauthTokens).values({
    tokenHash: hash(token),
    clientId,
    userId,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });

  return { token, expiresInSeconds: Math.floor(TOKEN_TTL_MS / 1000) };
}

export async function userForToken(token: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.oauthTokens)
    .where(eq(schema.oauthTokens.tokenHash, hash(token)))
    .limit(1);

  const row = rows[0];
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return row.userId;
}

/** Housekeeping. Expired rows are useless and should not accumulate. */
export async function pruneExpired(): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db.delete(schema.oauthCodes).where(lt(schema.oauthCodes.expiresAt, now));
  await db.delete(schema.oauthTokens).where(lt(schema.oauthTokens.expiresAt, now));
}
