import 'server-only';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db/client';
import { ssoUrl } from './handoff';
import { ACCOUNT_HOST, hostOf, PATH_HEADER } from './hosts';
import { getSessionUser } from './session';
import type { AccountProfile } from '@/lib/account/types';

/**
 * The account behind the current request, or a trip to the front door.
 *
 * The account host holds its own session — see `lib/auth/handoff.ts` — but the
 * first visit after signing in elsewhere has none, and the visitor is
 * indistinguishable from someone who never signed in at all. Both are sent to
 * the auth host, which knows the difference and either waves them through or
 * asks them to sign in.
 */

/**
 * Breadcrumb dropped by the adopt route, so a failed adoption stops rather than
 * bouncing forever.
 *
 * If a session was just established and this page still cannot see one,
 * something is wrong with the cookie rather than with the visitor, and sending
 * them back to be signed in again would do it again, and again. Deliberately not
 * `__Host-` prefixed: a rejected `__Host-` cookie is one of the failures this is
 * here to catch, so it must be able to survive what the session did not.
 */
const ATTEMPT_COOKIE = 'hk_sso_attempt';
export const ATTEMPT_MAX_AGE = 30;

export function attemptCookie() {
  return {
    name: ATTEMPT_COOKIE,
    value: '1',
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ATTEMPT_MAX_AGE,
  };
}

/**
 * The URL the visitor is currently looking at, for the round trip back.
 *
 * The path comes from the header the middleware attaches. A server component
 * cannot otherwise know its own address, and Next's internal routing headers are
 * not a contract to build on.
 */
async function currentUrl(): Promise<string> {
  const headerList = await headers();
  const host = hostOf(headerList.get('host')) || ACCOUNT_HOST;
  const path = headerList.get(PATH_HEADER) || '/account';
  return `https://${host}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Require a signed-in account.
 *
 * Returns `null` — rather than redirecting again — when the handoff has just run
 * and produced nothing. The caller renders an explanation, which is the one
 * outcome another redirect cannot improve.
 *
 * A result rather than an exception on purpose: `redirect()` works by throwing,
 * so a caller wrapping this in try/catch would swallow the redirect along with
 * everything else.
 */
export async function requireAccount(): Promise<AccountProfile | null> {
  const session = await getSessionUser();

  if (!session) {
    const jar = await cookies();
    if (jar.get(ATTEMPT_COOKIE)) return null;
    redirect(ssoUrl(await currentUrl()));
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);

  const user = rows[0];

  // Deleted while the session was still live. A session is not permission to
  // exist, so it does not outlive the account it belongs to.
  if (!user || user.status === 'deleted') redirect(ssoUrl(await currentUrl()));

  return {
    id: user.id,
    userId: user.userId,
    accountType: user.accountType,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
