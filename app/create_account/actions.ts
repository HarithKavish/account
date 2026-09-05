'use server';

import { createAccount } from '@/lib/account/service';
import type { AccountError } from '@/lib/account/types';

/**
 * Account creation, invoked from the signup form.
 *
 * Server Actions carry Next.js's built-in Origin/Host check, which is what
 * provides CSRF protection for this state-changing operation.
 *
 * Returns only what the browser is allowed to see: the new account's public
 * identifier and name. No internal UUID, no password hash, no row.
 */
export interface SignupSuccess {
  userId: string;
  firstName: string;
}

export type SignupState =
  | { status: 'idle' }
  | { status: 'success'; account: SignupSuccess }
  | { status: 'error'; error: AccountError };

export async function createAccountAction(formData: FormData): Promise<SignupState> {
  const value = (name: string) => {
    const raw = formData.get(name);
    return typeof raw === 'string' ? raw : '';
  };

  const result = await createAccount({
    firstName: value('firstName'),
    lastName: value('lastName'),
    email: value('email'),
    userId: value('userId'),
    password: value('password'),
    confirmPassword: value('confirmPassword'),
  });

  if (!result.ok) {
    return { status: 'error', error: result.error };
  }

  return {
    status: 'success',
    // Signup always chooses a user id, so this is non-null here. A federated
    // account is the case where it is not, and it does not pass through signup.
    account: { userId: result.data.userId ?? '', firstName: result.data.firstName },
  };
}
