import { NextResponse } from 'next/server';

import { findClient, redirectAllowed } from '@/lib/oauth/clients';
import { issueCode } from '@/lib/oauth/store';
import { getSessionUser } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Where a surface sends someone to find out who they are.
 *
 * If they are signed in here, this hands back a code. If they are not, it sends
 * them to the front door first and comes back — which is what makes signing in
 * to one surface a sign-in for all of them.
 *
 * Errors are answered two different ways on purpose. A bad `client_id` or a
 * `redirect_uri` we do not recognise is answered here, in plain text: we must
 * not bounce a request to an address we have not verified, because that is an
 * open redirect wearing an OAuth costume. Everything after that is reported to
 * the client's own registered address, as the spec expects.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const client = findClient(params.get('client_id'));
  const redirectUri = params.get('redirect_uri');

  if (!client || !redirectAllowed(client, redirectUri)) {
    return new NextResponse('Unknown client or redirect URI.', {
      status: 400,
      headers: { 'content-type': 'text/plain' },
    });
  }

  const target = new URL(redirectUri as string);
  const state = params.get('state');

  const fail = (code: string) => {
    target.searchParams.set('error', code);
    if (state) target.searchParams.set('state', state);
    return NextResponse.redirect(target);
  };

  if (params.get('response_type') !== 'code') return fail('unsupported_response_type');

  // PKCE is mandatory (V13), and only S256. Without it a code intercepted in a
  // redirect is enough on its own.
  const challenge = params.get('code_challenge');
  if (!challenge || params.get('code_challenge_method') !== 'S256') {
    return fail('invalid_request');
  }

  const session = await getSessionUser();
  if (!session) {
    // Sign in first, then come back to this exact request.
    const front = new URL('/login', url.origin);
    front.searchParams.set('next', url.pathname + url.search);
    return NextResponse.redirect(front);
  }

  const code = await issueCode({
    clientId: client.id,
    userId: session.userId,
    redirectUri: redirectUri as string,
    codeChallenge: challenge,
  });

  target.searchParams.set('code', code);
  if (state) target.searchParams.set('state', state);
  return NextResponse.redirect(target);
}
