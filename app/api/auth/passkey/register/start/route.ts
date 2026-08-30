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
   * Left unsaid, a browser shows its generic chooser — and on Android that
   * chooser offers a USB key and another device while omitting the phone's own
   * passkey manager, which is the one thing someone holding the phone actually
   * wants. Naming `platform` asks this device for a passkey of its own.
   */
  let attachment: 'platform' | 'cross-platform' | undefined;
  try {
    const body = (await request.json()) as { attachment?: string };
    if (body.attachment === 'platform' || body.attachment === 'cross-platform') {
      attachment = body.attachment;
    }
  } catch {
    // No body is a valid request: let the browser offer everything it has.
  }

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
    userName: user.userId ?? user.email ?? `${user.firstName} ${user.lastName}`.trim(),
    userDisplayName: `${user.firstName} ${user.lastName}`.trim(),
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
       * Required, not preferred. A passkey is a verified credential by
       * definition, and platform managers — Google Password Manager among them —
       * decline to store one that does not ask for verification.
       */
      userVerification: 'required',
      ...(attachment ? { authenticatorAttachment: attachment } : {}),
    },
  });

  await rememberChallenge({
    challenge: options.challenge,
    ceremony: 'register',
    userId: session.userId,
  });

  return NextResponse.json(options, { headers: { 'cache-control': 'no-store' } });
}
