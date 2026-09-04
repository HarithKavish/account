import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';

import { RP_ID, rememberChallenge } from '@/lib/auth/webauthn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Begin signing in with a passkey.
 *
 * Deliberately requires nothing of the caller — no address, no user ID, not even
 * a hint. There is no `allowCredentials`, which is what makes the ceremony
 * discoverable: the authenticator offers whatever it holds for this domain, and
 * the account is whatever the chosen credential turns out to belong to.
 *
 * That absence is a security property, not a convenience. Any endpoint that
 * answered "which passkeys does this person have?" would answer "does this
 * person have an account?" to anyone who asked.
 */
export async function POST() {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    // The authenticator must verify the person — a fingerprint, a face, a PIN.
    // What it verified never reaches this server; only that it did.
    userVerification: 'preferred',
  });

  await rememberChallenge({ challenge: options.challenge, ceremony: 'authenticate' });

  return NextResponse.json(options, { headers: { 'cache-control': 'no-store' } });
}
