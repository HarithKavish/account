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
export async function POST() {
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

  const existing = await db
    .select({ credentialId: schema.webauthnCredentials.credentialId })
    .from(schema.webauthnCredentials)
    .where(eq(schema.webauthnCredentials.userId, session.userId));

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
     * Already-registered credentials are excluded so an authenticator offers to
     * create a new one rather than silently replacing what it holds. Adding a
     * second passkey must never cost someone the first.
     */
    excludeCredentials: existing.map((row) => ({ id: row.credentialId })),
    authenticatorSelection: {
      /*
       * Discoverable, because sign-in must work without anyone typing who they
       * are. A credential the authenticator cannot find on its own could only be
       * offered from a list we supplied, which would mean enumerating accounts.
       */
      residentKey: 'required',
      userVerification: 'preferred',
    },
  });

  await rememberChallenge({
    challenge: options.challenge,
    ceremony: 'register',
    userId: session.userId,
  });

  return NextResponse.json(options, { headers: { 'cache-control': 'no-store' } });
}
