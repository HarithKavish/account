import { NextResponse } from 'next/server';

import { linkProfileProvider } from '@/lib/account/connections';
import { completeFlow } from '@/lib/auth/gravatar';
import { gravatarRedirectUri, safeNext, takeFlowCookie } from '@/lib/auth/flow';
import { destinationFor } from '@/lib/auth/handoff';
import { ACCOUNT_HOST } from '@/lib/auth/hosts';
import { getSessionUser } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Return from Gravatar.
 *
 * There is no sign-in branch here, and that is the point: this provider lends a
 * profile to an account that already exists and can never bring one into being.
 * No session is issued — the one in hand is the one that asked.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const back = (params: Record<string, string>) => {
    const target = new URL('/security', `https://${ACCOUNT_HOST}`);
    for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
    return target;
  };

  // Every guard below produces the same page, so the log is the only place the
  // difference survives.
  const refuse = (why: string, detail?: unknown) => {
    console.error(`[gravatar] callback refused: ${why}`, detail ?? '');
    return NextResponse.redirect(back({ error: 'link_failed' }));
  };

  const flow = await takeFlowCookie();
  if (!flow) return refuse('no flow cookie');
  if (flow.provider !== 'gravatar') return refuse('flow belongs to another provider', flow.provider);

  const returned = url.searchParams.get('error');
  if (returned) {
    return refuse('provider returned an error', {
      error: returned,
      description: url.searchParams.get('error_description')?.slice(0, 200),
    });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code) return refuse('no code in callback');
  if (!state || state !== flow.state) return refuse('state did not match');

  const session = await getSessionUser();
  if (!session) return refuse('no session on this host');

  const identity = await completeFlow(code, gravatarRedirectUri());
  if (!identity) return refuse('flow did not complete');

  const linked = await linkProfileProvider(session.userId, {
    issuer: identity.issuer,
    subject: identity.subject,
    pictureUrl: identity.avatarUrl,
    profile: identity.profile,
  });

  const requested = new URL(safeNext(flow.next), `https://${ACCOUNT_HOST}`);
  if (linked.ok) requested.searchParams.set('connected', 'gravatar');
  else {
    requested.searchParams.set(
      'error',
      linked.error.code === 'identity_taken' ? 'link_taken' : 'link_failed',
    );
  }

  return NextResponse.redirect(
    await destinationFor(requested.toString(), url.hostname, session.userId),
  );
}
