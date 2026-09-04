import { NextResponse } from 'next/server';

import { authorizeUrl, beginFlow } from '@/lib/auth/google';
import { hasGoogleEnv } from '@/lib/env';
import { redirectUri, setFlowCookie } from '@/lib/auth/flow';
import { getSessionUser } from '@/lib/auth/session';
import { AUTH_HOST, hostOf } from '@/lib/auth/hosts';
import { headers } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Start the Google flow.
 *
 * The state, nonce and PKCE verifier are held in a short-lived host-only cookie
 * rather than server state: they are meaningless to anyone but this browser, and
 * a round trip that survives a redeploy is worth more than a row.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next');
  const linking = url.searchParams.get('mode') === 'link';

  /*
   * The flow begins at the front door or it does not begin.
   *
   * The state, nonce and verifier ride in a `__Host-` cookie, which is host-only
   * — so a flow started here and returned to the front door could not read its
   * own secrets. Together with the pinned redirect URI this leaves exactly one
   * host that can run a round trip, which is the point.
   */
  const headerList = await headers();
  if (hostOf(headerList.get('host')) !== AUTH_HOST) {
    const front = new URL('/api/auth/google/start', `https://${AUTH_HOST}`);
    front.search = url.search;
    return NextResponse.redirect(front);
  }

  /*
   * Connecting a provider is something an account does, so there has to be one.
   * Checked when the trip starts as well as when it returns: a flow begun
   * without a session would otherwise walk someone through Google's consent
   * screen only to refuse them on the way back.
   */
  if (linking && !(await getSessionUser())) {
    // Sign in first, then carry straight on with the connection they asked for
    // rather than dropping them on a page with no explanation.
    const login = new URL('/', `https://${AUTH_HOST}`);
    login.searchParams.set('next', url.pathname + url.search);
    return NextResponse.redirect(login);
  }

  // Not configured here. Send them back to a page that works rather than
  // failing with a server error for something that is a deployment setting.
  if (!hasGoogleEnv()) {
    return NextResponse.redirect(`${url.origin}/login?error=google_unavailable`);
  }

  const secrets = beginFlow();
  await setFlowCookie(secrets, next, linking ? 'link' : 'sign-in', 'google');

  return NextResponse.redirect(authorizeUrl(secrets, redirectUri()));
}
