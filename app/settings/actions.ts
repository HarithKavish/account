'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { isPictureSource, resolvePicture, setPictureSource } from '@/lib/account/connections';
import { updateName } from '@/lib/account/manage';
import { publishDisplayUser } from '@/lib/auth/ecosystem-cookie';
import { requireAccount } from '@/lib/auth/require';

export interface FieldState {
  error: string | null;
  saved: boolean;
}

/**
 * Tell the rest of the ecosystem what changed.
 *
 * Every other surface draws its header from this cookie, so a name or picture
 * changed here is stale everywhere until it is republished. Display only — see
 * ecosystem-cookie.ts.
 */
async function republish(userId: string, name: string) {
  const headerList = await headers();
  await publishDisplayUser(
    {
      name,
      email: null,
      picture: await resolvePicture(userId),
      provider: 'password',
    },
    headerList.get('host')?.split(':')[0] ?? '',
  );
}

/** Save one name field. The other is left exactly as it was. */
export async function saveNameField(
  _previous: FieldState,
  formData: FormData,
): Promise<FieldState> {
  const account = await requireAccount();
  if (!account) return { error: 'You are not signed in.', saved: false };

  const field = String(formData.get('field') ?? '');
  const value = String(formData.get('value') ?? '');

  if (field !== 'firstName' && field !== 'lastName') {
    return { error: 'That field cannot be edited.', saved: false };
  }

  const result = await updateName(account.id, {
    firstName: field === 'firstName' ? value : account.firstName,
    lastName: field === 'lastName' ? value : account.lastName,
  });

  if (!result.ok) return { error: result.error.message, saved: false };

  await republish(account.id, `${result.data.firstName} ${result.data.lastName}`.trim());

  revalidatePath('/settings');
  revalidatePath('/account');
  return { error: null, saved: true };
}

/** Choose which connected account lends this one its picture. */
export async function savePictureSource(
  _previous: FieldState,
  formData: FormData,
): Promise<FieldState> {
  const account = await requireAccount();
  if (!account) return { error: 'You are not signed in.', saved: false };

  const source = String(formData.get('source') ?? '');
  if (!isPictureSource(source)) {
    return { error: 'That is not a picture you can choose.', saved: false };
  }

  const result = await setPictureSource(account.id, source);
  if (!result.ok) return { error: result.error.message, saved: false };

  await republish(account.id, `${account.firstName} ${account.lastName}`.trim());

  revalidatePath('/settings');
  revalidatePath('/account');
  return { error: null, saved: true };
}
