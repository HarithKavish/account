import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';

import { findByCredentialId, markUsed } from '@/lib/account/passkeys';
import { resolvePicture } from '@/lib/account/connections';
import { publishDisplayUser } from '@/lib/auth/ecosystem-cookie';
import { safeNext } from '@/lib/auth/flow';
import { destinationFor } from '@/lib/auth/handoff';
import { hostOf } from '@/lib/auth/hosts';
import { createSession } from '@/lib/auth/session';
import { RP_ID, allowedOrigins, takeChallenge } from '@/lib/auth/webauthn';
import { getDb, schema } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Finish signing in with a passkey.
 *
 * The session created here is the same opaque, revocable session a password or a
 * provider produces. How someone proved who they are is not recorded in what
 * they hold afterwards, and nothing downstream can tell the difference — which
 * is the point.
 */
export async function POST(request: Request) {
  const asked = await takeChallenge('authenticate');
  if (!asked) {
    return NextResponse.json({ error: 'challenge_expired' }, { status: 400 });
  }

  let body: AuthenticationResponseJSON & { next?: string };
  try {
    body = (await request.json()) as AuthenticationResponseJSON & { next?: string };
  } catch {
    return NextResponse.json({ error: 'malformed' }, { status: 400 });
  }

  const stored = await findByCredentialId(body.id);
  if (!stored) {
    // An unknown credential and a failed signature get the same answer. Saying
    // "no such passkey" would let someone learn which credentials exist here.
    console.error('[passkey] no credential for id');
    return NextResponse.json({ error: 'verification_failed' }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: asked.challenge,
      expectedOrigin: allowedOrigins(),
      expectedRPID: RP_ID,
      requireUserVerification: false,
      credential: {
        id: stored.credentialId,
        publicKey: new Uint8Array(Buffer.from(stored.publicKey, 'base64url')),
        counter: stored.counter,
        transports: stored.transports ? JSON.parse(stored.transports) : undefined,
      },
    });
  } catch (error) {
    console.error('[passkey] authentication verification threw:', error);
    return NextResponse.json({ error: 'verification_failed' }, { status: 400 });
  }

  if (!verification.verified) {
    console.error('[passkey] authentication not verified');
    return NextResponse.json({ error: 'verification_failed' }, { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, stored.userId))
    .limit(1);

  const user = rows[0];
  // A credential outlives nothing. If the account is gone, so is the way in.
  if (!user || user.status === 'deleted') {
    return NextResponse.json({ error: 'verification_failed' }, { status: 400 });
  }

  await markUsed(stored.id, verification.authenticationInfo.newCounter);

  const headerList = await headers();
  await createSession(user.id, headerList.get('user-agent'));
  await publishDisplayUser(
    {
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: null,
      picture: await resolvePicture(user.id),
      provider: 'password',
    },
    hostOf(headerList.get('host')),
  );

  const destination = await destinationFor(
    safeNext(body.next ?? null),
    hostOf(headerList.get('host')),
    user.id,
  );

  return NextResponse.json({ next: destination }, { headers: { 'cache-control': 'no-store' } });
}
