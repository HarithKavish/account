'use server';

import { revalidatePath } from 'next/cache';

import { changePassword, chooseUserId } from '@/lib/account/manage';
import { issueRecoveryCodes } from '@/lib/account/identity';
import { requireAccount } from '@/lib/auth/require';
import { destroyAllSessions } from '@/lib/auth/session';
import { stashRecoveryCodes } from '@/lib/auth/recovery-handoff';
import { redirect } from 'next/navigation';

export interface UserIdState {
  error: string | null;
  saved: boolean;
}

/** Claim a user ID, for an account created through a provider without one. */
export async function saveUserId(
  _previous: UserIdState,
  formData: FormData,
): Promise<UserIdState> {
  const account = await requireAccount();
  if (!account) return { error: 'You are not signed in.', saved: false };

  const result = await chooseUserId(account.id, String(formData.get('userId') ?? ''));
  if (!result.ok) return { error: result.error.message, saved: false };

  revalidatePath('/security');
  revalidatePath('/settings');
  revalidatePath('/account');
  return { error: null, saved: true };
}

export interface PasswordState {
  error: string | null;
  field: string | null;
  saved: boolean;
}

export async function savePassword(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const account = await requireAccount();
  if (!account) return { error: 'You are not signed in.', field: null, saved: false };

  const result = await changePassword(account.id, {
    currentPassword: String(formData.get('currentPassword') ?? ''),
    newPassword: String(formData.get('newPassword') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  });

  if (!result.ok) {
    return { error: result.error.message, field: result.error.field ?? null, saved: false };
  }

  revalidatePath('/security');
  return { error: null, field: null, saved: true };
}

/**
 * Replace the recovery codes.
 *
 * Issuing invalidates whatever was there, so the new set is shown once on the
 * page that already exists for exactly this — the same screen a new federated
 * account sees.
 */
export async function regenerateRecoveryCodes(): Promise<void> {
  const account = await requireAccount();
  if (!account) redirect('/account');

  const codes = await issueRecoveryCodes(account.id);
  if (!codes.ok) redirect('/security');

  await stashRecoveryCodes(codes.data);
  redirect('/recovery-codes');
}

/**
 * End every session, everywhere — including this one.
 *
 * The point of the control is to evict a session you cannot reach, so keeping
 * the current one alive would defeat it. The visitor signs in again, which is
 * the proof that they are the one who pressed it.
 */
export async function signOutEverywhere(): Promise<void> {
  const account = await requireAccount();
  if (!account) redirect('/account');

  await destroyAllSessions(account.id);
  redirect('/signout');
}
