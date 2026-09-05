'use client';

import { useActionState, useState } from 'react';

import { Field } from '@/components/form';
import { confirmDelete, type DeleteState } from './actions';

/* Seeded here: a "use server" module may only export async functions. */
const INITIAL: DeleteState = { error: null };

/**
 * Deleting is irreversible, so the button stays disabled until the identifier
 * has been typed exactly — deliberate friction, proportional to the consequence.
 */
export function DeleteForm({ confirmWith }: { confirmWith: string }) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(
    confirmDelete,
    INITIAL,
  );
  const [typed, setTyped] = useState('');

  const matches = typed.trim().toLowerCase() === confirmWith.toLowerCase();

  return (
    <form action={action} className="stack">
      <Field
        label={`Type ${confirmWith} to confirm`}
        name="confirm"
        value={typed}
        onChange={setTyped}
        autoComplete="off"
        error={state.error ?? undefined}
      />

      <div className="form__actions">
        <button
          type="submit"
          className="button button--danger"
          disabled={!matches || pending}
        >
          {pending ? 'Deleting…' : 'Delete my account'}
        </button>
      </div>
    </form>
  );
}
