import { NextResponse, type NextRequest } from 'next/server';

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
const AUTH_HOST = 'auth.harithkavish.com';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0].toLowerCase();
  if (host !== AUTH_HOST) return NextResponse.next();

  const { pathname, search } = request.nextUrl;

  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.rewrite(url);
  }

  // Managing an account is the account host's job. Someone who lands on this
  // host asking for one is sent there rather than shown a second copy of it.
  if (pathname === '/create_account' || pathname === '/signup') {
    return NextResponse.redirect(
      new URL(`https://account.harithkavish.com/create_account${search}`),
    );
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's own assets and the icon, so the rewrite above sees
  // real navigations only.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png).*)'],
};
