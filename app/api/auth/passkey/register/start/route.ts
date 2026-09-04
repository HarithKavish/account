import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db/client';
import { RP_ID, RP_NAME, rememberChallenge } from '@/lib/auth/webauthn';
import { getSessionUser } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Begin adding a passkey.
 *
 * Registering is something an account does, so there has to be one signed in.
 * The challenge is remembered in a host-only cookie and answered once.
 */
export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);

  const user = rows[0];
  if (!user || user.status === 'deleted') {
    return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  }

  /*
   * Which kind of authenticator to ask for.
   *
   * By default we steer towards `client-device` (platform passkey manager on the phone/laptop).
   * If the client explicitly detects and reports that no platform authenticator is available,
   * we hint towards hybrid / security-key.
   */
  let platformAvailable = true;
  try {
    const body = (await request.json()) as { platformAvailable?: boolean };
    if (typeof body.platformAvailable === 'boolean') {
      platformAvailable = body.platformAvailable;
    }
  } catch {
    // No body or invalid JSON: default to client-device
  }

  const userName =
    user.userId || user.email || `${user.firstName} ${user.lastName}`.trim() || 'User';
  const userDisplayName =
    `${user.firstName} ${user.lastName}`.trim() || user.userId || user.email || 'User';

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    /*
     * The account id, not the user ID or the address.
     *
     * It is shown by some authenticators and stored by all of them, and it is
     * the one identifier that never changes and says nothing about the person.
     */
    userID: new TextEncoder().encode(user.id),
    userName,
    userDisplayName,
    supportedAlgorithmIDs: [-7, -257],
    // Nothing here needs to know which authenticator model was used, and asking
    // for attestation would collect exactly that.
    attestationType: 'none',
    /*
     * Deliberately no `excludeCredentials`.
     *
     * Excluding what an account already holds stops one authenticator making two
     * credentials — reasonable in itself, but with synced passkeys an
     * "authenticator" is a password manager spanning every device signed into
     * it. One passkey then removes that manager as an option everywhere, which
     * is how a phone ends up being offered a USB key and another device but not
     * itself.
     *
     * The cost is that a device may hold two credentials for this account. Both
     * work, both are listed, and either can be removed. That is a better failure
     * than being unable to register the device in your hand.
     */
    authenticatorSelection: {
      /*
       * Discoverable, because sign-in must work without anyone typing who they
       * are. A credential the authenticator cannot find on its own could only be
       * offered from a list we supplied, which would mean enumerating accounts.
       */
      residentKey: 'required',
      /*
       * Preferred user verification allows Android Credential Manager, Windows Hello,
       * and Apple Keychain to verify via biometric or device PIN/pattern without throwing
       * NotReadableError if hardware biometric attestation is not strictly enforced.
       */
      userVerification: 'preferred',
      /*
       * When the device has a platform authenticator (e.g. Android phone with screen lock,
       * Windows Hello, Touch ID), specifying `authenticatorAttachment: 'platform'` explicitly
       * instructs Android/Chrome Credential Manager to create the passkey on THIS device
       * (in Google Password Manager / local enclave) rather than offering a cross-device QR code.
       */
      ...(platformAvailable ? { authenticatorAttachment: 'platform' as const } : {}),
    },
  });

  await rememberChallenge({
    challenge: options.challenge,
    ceremony: 'register',
    userId: session.userId,
  });

  // Return clean, standard WebAuthn Level 2 options directly (no conflicting hints)
  return NextResponse.json(options, { headers: { 'cache-control': 'no-store' } });
}
