import { NextResponse } from 'next/server';

import { resolveFederatedIdentity, issueRecoveryCodes } from '@/lib/account/identity';
import { completeFlow } from '@/lib/auth/google';
import { redirectUri, safeNext, takeFlowCookie } from '@/lib/auth/flow';
import { createSession } from '@/lib/auth/session';
import { stashRecoveryCodes } from '@/lib/auth/recovery-handoff';
import { publishDisplayUser } from '@/lib/auth/ecosystem-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Every failure lands here. The reason is never in the URL. */
function refuse(origin: string) {
  return NextResponse.redirect(`${origin}/login?error=sign_in_failed`);
}

/**
 * Return from Google — contract §7.6.
 *
 * The assertion is verified here, the account half is asked which HarithKavish
 * account the subject belongs to, and only then does a session exist.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  const flow = await takeFlowCookie();
  if (!flow) return refuse(origin);

  // Google reports its own failures — a denied consent, a cancelled prompt.
  if (url.searchParams.get('error')) return refuse(origin);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // The state must be the one this browser started with, or the callback is
  // someone else's — which is the whole point of carrying it.
  if (!code || !state || state !== flow.state) return refuse(origin);

  const identity = await completeFlow(code, flow, redirectUri(origin));
  if (!identity) return refuse(origin);

  const resolved = await resolveFederatedIdentity(identity);
  if (!resolved.ok) return refuse(origin);

  const { profile, created } = resolved.data;
  await createSession(profile.id, request.headers.get('user-agent'));

  // Tell the rest of the ecosystem who is here, so nexus and the blog stop
  // asking someone who just signed in. Display only — see ecosystem-cookie.ts.
  await publishDisplayUser(
    {
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      email: identity.emailVerified ? identity.email : null,
      picture: null,
      provider: 'google',
    },
    url.hostname,
  );

  // A federated-only account has exactly one way in, and the ecosystem does not
  // control it. Codes are issued at creation and shown once, before the person
  // goes anywhere else — waiting for them to ask is how lockout happens.
  if (created) {
    const codes = await issueRecoveryCodes(profile.id);
    if (codes.ok) {
      await stashRecoveryCodes(codes.data);
      return NextResponse.redirect(`${origin}/recovery-codes`);
    }
  }

  return NextResponse.redirect(`${origin}${safeNext(flow.next)}`);
}
