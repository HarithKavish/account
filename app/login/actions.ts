'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { verifyAccountPassword } from '@/lib/account/identity';
import { publishDisplayUser } from '@/lib/auth/ecosystem-cookie';
import { createSession } from '@/lib/auth/session';
import { destinationFor } from '@/lib/auth/handoff';
import { hostOf } from '@/lib/auth/hosts';
import { safeNext } from '@/lib/auth/flow';

export interface LoginState {
  error: string | null;
}

/**
 * Password sign-in.
 *
 * One message for every failure. Distinguishing "no such user" from "wrong
 * password" — or from "that account signs in with Google" — tells an attacker
 * which accounts exist and how to attack them.
 */
export async function signInWithPassword(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const userId = String(formData.get('userId') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!userId || !password) {
    return { error: 'Enter your user ID and password.' };
  }

  const profile = await verifyAccountPassword(userId, password);
  if (!profile) {
    return { error: 'That user ID and password do not match an account.' };
  }

  const headerList = await headers();
  await createSession(profile.id, headerList.get('user-agent'));
  await publishDisplayUser(
    {
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      email: null,
      picture: null,
      provider: 'password',
    },
    headerList.get('host')?.split(':')[0] ?? '',
  );

  /*
   * Where they land, and with a session when they get there.
   *
   * A destination on another of our hostnames cannot see the cookie just set —
   * `__Host-` is host-only — so the trip goes through that host's adopt route,
   * which establishes a session of its own. Anywhere else is unchanged.
   */
  const destination = safeNext(String(formData.get('next') ?? '') || null);
  redirect(await destinationFor(destination, hostOf(headerList.get('host')), profile.id));
}
