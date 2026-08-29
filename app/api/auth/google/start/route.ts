import { NextResponse } from 'next/server';

import { authorizeUrl, beginFlow } from '@/lib/auth/google';
import { hasGoogleEnv } from '@/lib/env';
import { redirectUri, setFlowCookie } from '@/lib/auth/flow';

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

  // Not configured here. Send them back to a page that works rather than
  // failing with a server error for something that is a deployment setting.
  if (!hasGoogleEnv()) {
    return NextResponse.redirect(`${url.origin}/login?error=google_unavailable`);
  }

  const secrets = beginFlow();
  await setFlowCookie(secrets, next);

  return NextResponse.redirect(authorizeUrl(secrets, redirectUri(url.origin)));
}
