import { NextResponse } from 'next/server';

import { resolveFederatedIdentity, issueRecoveryCodes } from '@/lib/account/identity';
import { linkIdentity, resolvePicture } from '@/lib/account/connections';
import { completeFlow } from '@/lib/auth/google';
import { redirectUri, safeNext, takeFlowCookie } from '@/lib/auth/flow';
import { destinationFor } from '@/lib/auth/handoff';
import { createSession, getSessionUser } from '@/lib/auth/session';
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

  /*
   * Connecting a provider to the account already signed in.
   *
   * Deliberately never reaches `resolveFederatedIdentity`: that function may
   * create an account, and the whole point of linking is that the account
   * already exists. No session is issued either — the one in hand is the one
   * that asked.
   */
  if (flow.mode === 'link') {
    const session = await getSessionUser();
    if (!session) return refuse(origin);

    const linked = await linkIdentity(session.userId, identity);
    const back = new URL('/security', origin);
    if (!linked.ok) back.searchParams.set('error', 'link_failed');
    else back.searchParams.set('connected', 'google');
    return NextResponse.redirect(back);
  }

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
      picture: await resolvePicture(profile.id),
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

  /*
   * `safeNext` returns an absolute URL for another ecosystem host and a path for
   * this one, so it is resolved against the origin rather than concatenated with
   * it — `origin + "https://nexus…"` is not a URL.
   *
   * As with password sign-in, a destination on one of our own hostnames goes via
   * its adopt route so it arrives holding a session.
   */
  const destination = new URL(safeNext(flow.next), origin).toString();
  return NextResponse.redirect(await destinationFor(destination, url.hostname, profile.id));
}
