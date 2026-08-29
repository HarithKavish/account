'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { verifyAccountPassword } from '@/lib/account/identity';
import { publishDisplayUser } from '@/lib/auth/ecosystem-cookie';
import { createSession } from '@/lib/auth/session';
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

  redirect(safeNext(String(formData.get('next') ?? '') || null));
}
