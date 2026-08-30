import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

import { saveCredential } from '@/lib/account/passkeys';
import { RP_ID, allowedOrigins, takeChallenge } from '@/lib/auth/webauthn';
import { getSessionUser } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Finish adding a passkey.
 *
 * The library performs every check that matters — challenge, origin, RP ID,
 * signature, authenticator data — and this route decides only what to do with a
 * verdict it did not reach itself.
 */
export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  }

  // Read once, gone whatever happens next.
  const asked = await takeChallenge('register');
  if (!asked || asked.userId !== session.userId) {
    return NextResponse.json({ error: 'challenge_expired' }, { status: 400 });
  }

  let body: RegistrationResponseJSON;
  try {
    body = (await request.json()) as RegistrationResponseJSON;
  } catch {
    return NextResponse.json({ error: 'malformed' }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: asked.challenge,
      expectedOrigin: allowedOrigins(),
      expectedRPID: RP_ID,
      // Registration asked for verification, so registration insists on it.
      requireUserVerification: true,
    });
  } catch (error) {
    // The detail belongs in the log, not in the response: what failed is useful
    // to whoever maintains this and useful to nobody else.
    console.error('[passkey] registration verification threw:', error);
    return NextResponse.json({ error: 'verification_failed' }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    console.error('[passkey] registration not verified');
    return NextResponse.json({ error: 'verification_failed' }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  const saved = await saveCredential({
    userId: session.userId,
    credentialId: credential.id,
    // A public key, stored as what it is. The private half never left the
    // authenticator and was never offered to us.
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: body.response.transports ?? [],
    deviceType: credentialDeviceType ?? null,
    backedUp: credentialBackedUp ?? false,
  });

  if (!saved.ok) {
    return NextResponse.json({ error: 'already_registered' }, { status: 409 });
  }

  return NextResponse.json({ passkey: saved.data }, { headers: { 'cache-control': 'no-store' } });
}
