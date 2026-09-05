import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { authorizeUrl } from '@/lib/auth/gravatar';
import { beginFlow } from '@/lib/auth/google';
import { gravatarRedirectUri, setFlowCookie } from '@/lib/auth/flow';
import { AUTH_HOST, hostOf } from '@/lib/auth/hosts';
import { getSessionUser } from '@/lib/auth/session';
import { hasGravatarEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Start connecting a Gravatar.
 *
 * Connect-only, so a session is required before the trip begins rather than
 * discovered on the way back: walking someone through a consent screen only to
 * refuse them afterwards is a waste of their time.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  // Same rule as the Google flow: the secrets ride in a host-only cookie and the
  // redirect URI names one host, so the trip begins at the front door or not at
  // all.
  const headerList = await headers();
  if (hostOf(headerList.get('host')) !== AUTH_HOST) {
    const front = new URL('/api/auth/gravatar/start', `https://${AUTH_HOST}`);
    front.search = url.search;
    return NextResponse.redirect(front);
  }

  if (!hasGravatarEnv()) {
    const back = new URL('/security', `https://${AUTH_HOST}`);
    back.searchParams.set('error', 'gravatar_unavailable');
    return NextResponse.redirect(back);
  }

  if (!(await getSessionUser())) {
    const login = new URL('/', `https://${AUTH_HOST}`);
    login.searchParams.set('next', url.pathname + url.search);
    return NextResponse.redirect(login);
  }

  const secrets = beginFlow();
  await setFlowCookie(secrets, url.searchParams.get('next'), 'link', 'gravatar');

  return NextResponse.redirect(authorizeUrl(secrets, gravatarRedirectUri()));
}
