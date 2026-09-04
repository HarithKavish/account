'use client';

import { useActionState, useState } from 'react';

import { Field } from '@/components/form';
import { saveUserId, type UserIdState } from './actions';

/* Seeded here: a "use server" module may only export async functions. */
const INITIAL: UserIdState = { error: null, saved: false };

/**
 * Claiming a user ID, for an account that never chose one.
 *
 * Once, not repeatedly: the ID is what other people may have learned to call
 * this account, so the form disappears as soon as there is one.
 */
export function UserIdForm() {
  const [state, action, pending] = useActionState<UserIdState, FormData>(saveUserId, INITIAL);
  const [userId, setUserId] = useState('');

  return (
    <form action={action} className="stack">
      <Field
        label="User ID"
        name="userId"
        value={userId}
        onChange={setUserId}
        autoComplete="username"
        error={state.error ?? undefined}
        hint="What you will type to sign in. It cannot be changed afterwards."
      />

      {state.saved ? (
        <p className="form-note" role="status">
          User ID set.
        </p>
      ) : null}

      <div className="form__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={pending || !userId.trim()}
        >
          {pending ? 'Saving…' : 'Set user ID'}
        </button>
      </div>
    </form>
  );
}
