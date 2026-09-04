import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db/client';
import { ACCOUNT_HOST, AUTH_HOST, isAdoptHost } from './hosts';

/**
 * Moving a signed-in person between our own hostnames.
 *
 * See `sessionTickets` in the schema for why this exists at all: the session
 * cookie is `__Host-` prefixed and therefore host-only, and widening it to the
 * parent domain would hand the session token to every subdomain, the GitHub
 * Pages sites included.
 *
 * A ticket proves "the auth host says this account is signed in, and only this
 * hostname may act on that". It is single-use, host-bound, and lives a minute —
 * long enough for a redirect, too short to be worth capturing from a log.
 */

/** One redirect. Anything longer is an unspent ticket sitting in a URL bar. */
const TTL_MS = 60_000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Mint a ticket that `host`, and only `host`, may redeem. */
export async function issueHandoffTicket(userId: string, host: string): Promise<string | null> {
  if (!isAdoptHost(host)) return null;

  const db = getDb();
  const token = randomBytes(32).toString('base64url');

  await db.insert(schema.sessionTickets).values({
    userId,
    tokenHash: hashToken(token),
    host,
    expiresAt: new Date(Date.now() + TTL_MS),
  });

  return token;
}

/**
 * Spend a ticket, returning the account it stands for.
 *
 * Single use is enforced in the UPDATE rather than checked and then written:
 * `used_at IS NULL` in the WHERE clause means two simultaneous redemptions
 * cannot both succeed, however they interleave.
 */
export async function consumeHandoffTicket(token: string, host: string): Promise<string | null> {
  if (!token) return null;

  const db = getDb();
  const claimed = await db
    .update(schema.sessionTickets)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.sessionTickets.tokenHash, hashToken(token)),
        eq(schema.sessionTickets.host, host.toLowerCase()),
        isNull(schema.sessionTickets.usedAt),
        gt(schema.sessionTickets.expiresAt, new Date()),
      ),
    )
    .returning({ userId: schema.sessionTickets.userId });

  return claimed[0]?.userId ?? null;
}

/** Spent and expired tickets are of no further use to anyone. */
export async function pruneHandoffTickets(): Promise<void> {
  const db = getDb();
  await db.delete(schema.sessionTickets).where(lt(schema.sessionTickets.expiresAt, new Date()));
}

/** Where a host should send someone who needs a session it cannot see. */
export function ssoUrl(returnTo: string): string {
  const url = new URL(`https://${AUTH_HOST}/sso`);
  url.searchParams.set('next', returnTo);
  return url.toString();
}

/**
 * The destination for someone who has just proved who they are on the auth host.
 *
 * If they are staying on this host, that is the destination unchanged. If they
 * are bound for a host that can hold its own session, the trip goes through that
 * host's adopt route so it arrives with one. A destination we do not run — a
 * blog post, say — is returned untouched: those surfaces read the shared display
 * cookie and hold no session at all.
 */
export async function destinationFor(
  destination: string,
  currentHost: string,
  userId: string,
): Promise<string> {
  let target: URL;
  try {
    target = new URL(destination, `https://${currentHost || AUTH_HOST}`);
  } catch {
    return destination;
  }

  const host = target.hostname.toLowerCase();
  if (host === currentHost.toLowerCase() || !isAdoptHost(host)) return destination;

  const ticket = await issueHandoffTicket(userId, host);
  if (!ticket) return destination;

  const adopt = new URL(`https://${host}/api/session/adopt`);
  adopt.searchParams.set('ticket', ticket);
  adopt.searchParams.set('next', target.toString());
  return adopt.toString();
}

/** The account host's own landing page, as an absolute URL. */
export function accountHome(): string {
  return `https://${ACCOUNT_HOST}/account`;
}
