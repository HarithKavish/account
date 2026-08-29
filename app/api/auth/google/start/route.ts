import { NextResponse } from 'next/server';

import { authorizeUrl, beginFlow } from '@/lib/auth/google';
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

  const secrets = beginFlow();
  await setFlowCookie(secrets, next);

  return NextResponse.redirect(authorizeUrl(secrets, redirectUri(url.origin)));
}
