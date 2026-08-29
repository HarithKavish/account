import { NextResponse, type NextRequest } from 'next/server';

import { ACCOUNT_HOST, AUTH_HOST, PATH_HEADER } from '@/lib/auth/hosts';

/**
 * Two hostnames, one deployable (contract §0.5).
 *
 * `auth.harithkavish.com` is where the ecosystem sends people to sign in, and
 * `account.harithkavish.com` is where they manage the account behind it. They
 * are the same application: the split is what a reader sees, not what runs.
 *
 * So the auth host answers `/` with the sign-in page rather than the account
 * landing page. A rewrite, not a redirect — the address someone was sent to is
 * the address they should still be looking at.
 */

/**
 * Carry the path forward to the server components.
 *
 * A page cannot ask for its own URL, and a page that needs a session needs to
 * say where to come back to. Next's internal routing headers would do it today
 * and are nobody's contract, so this sets one of our own.
 */
function withPath(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0].toLowerCase();
  const { pathname, search } = request.nextUrl;

  /*
   * One front door.
   *
   * Signing in can begin on exactly one host, so the provider round trip has
   * exactly one redirect URI to register. Two would work and would mean two
   * entries in a console, kept in step by hand, each an exact match (V14) —
   * and a mismatch is invisible until someone tries to sign in.
   *
   * So the account host does not offer a second sign-in page. It sends people
   * to the front door, and asks to have them back afterwards.
   */
  if (host === ACCOUNT_HOST && pathname === '/login') {
    const front = new URL(`https://${AUTH_HOST}/`);
    const requested = request.nextUrl.searchParams.get('next');
    front.searchParams.set('next', requested ?? `https://${ACCOUNT_HOST}/account`);
    return NextResponse.redirect(front);
  }

  if (host !== AUTH_HOST) return withPath(request);

  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const headers = new Headers(request.headers);
    headers.set(PATH_HEADER, pathname + search);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // Managing an account is the account host's job. Someone who lands on this
  // host asking for one is sent there rather than shown a second copy of it.
  if (pathname === '/create_account' || pathname === '/signup') {
    return NextResponse.redirect(
      new URL(`https://account.harithkavish.com/create_account${search}`),
    );
  }

  return withPath(request);
}

export const config = {
  // Everything except Next's own assets and the icon, so the rewrite above sees
  // real navigations only.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png).*)'],
};
