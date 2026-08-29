'use server';

import { redirect } from 'next/navigation';

import { deleteAccount } from '@/lib/account/manage';
import { clearDisplayUser } from '@/lib/auth/ecosystem-cookie';
import { requireAccount } from '@/lib/auth/require';
import { destroySession } from '@/lib/auth/session';
import { headers } from 'next/headers';

export interface DeleteState {
  error: string | null;
}

/**
 * Delete the account.
 *
 * The typed confirmation is the user's own identifier, so it cannot be guessed
 * from the page by someone who wandered up to an unlocked screen — they would
 * have to know whose account it is.
 */
export async function confirmDelete(
  _previous: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const account = await requireAccount();
  if (!account) return { error: 'You are not signed in.' };

  const expected = account.userId ?? `${account.firstName} ${account.lastName}`.trim();
  const typed = String(formData.get('confirm') ?? '').trim();

  if (!typed || typed.toLowerCase() !== expected.toLowerCase()) {
    return { error: `Type ${expected} exactly to confirm.` };
  }

  const result = await deleteAccount(account.id);
  if (!result.ok) return { error: result.error.message };

  // The sessions went with the account by cascade, but this browser is still
  // holding the cookie and the ecosystem is still showing the name.
  await destroySession();
  const headerList = await headers();
  await clearDisplayUser(headerList.get('host')?.split(':')[0] ?? '');

  redirect('/');
}
