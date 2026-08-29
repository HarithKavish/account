import 'server-only';

import { cookies } from 'next/headers';

/**
 * The ecosystem's shared display cookie.
 *
 * Every surface under `*.harithkavish.com` reads this to show who is signed in,
 * so nexus and the blog stop asking someone who signed in here a moment ago.
 * It is the same value `harith-store.js` writes in the browser, written from the
 * server so a real session produces it rather than a provider round trip in the
 * page.
 *
 * It says who someone appears to be. It never says what they may do: any
 * subdomain can write it, so nothing may authorise from it. Authorisation is the
 * `__Host-` session, verified here, every time — which is precisely why these
 * are two different cookies with two different scopes.
 */
const COOKIE = 'hk.user';
const DOMAIN = '.harithkavish.com';
const TTL_SECONDS = 365 * 24 * 60 * 60;

export interface DisplayUser {
  name: string;
  email: string | null;
  picture: string | null;
  /**
   * How they signed in, so a surface can say so honestly. A Google mark beside
   * the picture of someone who typed a password would simply be wrong.
   */
  provider: 'password' | 'google';
}

function shareable(host: string): boolean {
  return host === 'harithkavish.com' || host.endsWith(DOMAIN);
}

export async function publishDisplayUser(user: DisplayUser, host: string): Promise<void> {
  if (!shareable(host)) return;
  const jar = await cookies();
  jar.set(COOKIE, encodeURIComponent(JSON.stringify(user)), {
    domain: DOMAIN,
    path: '/',
    sameSite: 'lax',
    secure: true,
    // Readable by the shared store in the browser. It carries no authority, so
    // httpOnly would only stop the surfaces that need it from doing their job.
    httpOnly: false,
    maxAge: TTL_SECONDS,
  });
}

export async function clearDisplayUser(host: string): Promise<void> {
  if (!shareable(host)) return;
  const jar = await cookies();
  jar.set(COOKIE, '', { domain: DOMAIN, path: '/', maxAge: 0, secure: true, sameSite: 'lax' });
}
