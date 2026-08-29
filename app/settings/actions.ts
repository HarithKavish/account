'use server';

import { revalidatePath } from 'next/cache';

import { updateName } from '@/lib/account/manage';
import { publishDisplayUser } from '@/lib/auth/ecosystem-cookie';
import { requireAccount } from '@/lib/auth/require';
import { headers } from 'next/headers';

export interface ProfileState {
  error: string | null;
  field: string | null;
  saved: boolean;
}

export async function saveProfile(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const account = await requireAccount();
  if (!account) return { error: 'You are not signed in.', field: null, saved: false };

  const result = await updateName(account.id, {
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
  });

  if (!result.ok) {
    return { error: result.error.message, field: result.error.field ?? null, saved: false };
  }

  // The name is what every other surface displays, so a change here has to reach
  // them. Display only — see ecosystem-cookie.ts.
  const headerList = await headers();
  await publishDisplayUser(
    {
      name: `${result.data.firstName} ${result.data.lastName}`.trim(),
      email: null,
      picture: null,
      provider: 'password',
    },
    headerList.get('host')?.split(':')[0] ?? '',
  );

  revalidatePath('/settings');
  revalidatePath('/account');
  return { error: null, field: null, saved: true };
}
