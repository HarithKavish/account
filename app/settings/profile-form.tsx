'use client';

import { useActionState } from 'react';

import { Field } from '@/components/form';
import { useState } from 'react';
import { saveProfile, type ProfileState } from './actions';

/* Seeded here: a "use server" module may only export async functions. */
const INITIAL: ProfileState = { error: null, field: null, saved: false };

/** Editing the name the whole ecosystem shows. */
export function ProfileForm({
  firstName: initialFirst,
  lastName: initialLast,
}: {
  firstName: string;
  lastName: string;
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    saveProfile,
    INITIAL,
  );
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);

  const dirty = firstName !== initialFirst || lastName !== initialLast;

  return (
    <form action={action} className="stack">
      <Field
        label="First name"
        name="firstName"
        value={firstName}
        onChange={setFirstName}
        error={state.field === 'firstName' ? state.error ?? undefined : undefined}
      />
      <Field
        label="Last name"
        name="lastName"
        value={lastName}
        onChange={setLastName}
        error={state.field === 'lastName' ? state.error ?? undefined : undefined}
      />

      {state.error && !state.field ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.saved && !dirty ? (
        <p className="form-note" role="status">
          Saved.
        </p>
      ) : null}

      <div className="form__actions">
        <button type="submit" className="button button--primary" disabled={pending || !dirty}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
