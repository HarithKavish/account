import { NextResponse } from 'next/server';

import { authorizeUrl, beginFlow } from '@/lib/auth/google';
import { hasGoogleEnv } from '@/lib/env';
import { redirectUri, setFlowCookie } from '@/lib/auth/flow';
import { getSessionUser } from '@/lib/auth/session';

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
   * Connecting a provider is something an account does, so there has to be one.
   * Checked when the trip starts as well as when it returns: a flow begun
   * without a session would otherwise walk someone through Google's consent
   * screen only to refuse them on the way back.
   */
  if (linking && !(await getSessionUser())) {
    return NextResponse.redirect(`${url.origin}/security`);
  }

  // Not configured here. Send them back to a page that works rather than
  // failing with a server error for something that is a deployment setting.
  if (!hasGoogleEnv()) {
    return NextResponse.redirect(`${url.origin}/login?error=google_unavailable`);
  }

  const secrets = beginFlow();
  await setFlowCookie(secrets, next, linking ? 'link' : 'sign-in');

  return NextResponse.redirect(authorizeUrl(secrets, redirectUri(url.origin)));
}
