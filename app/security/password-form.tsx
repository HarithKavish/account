'use client';

import { useActionState, useState } from 'react';

import { Field } from '@/components/form';
import { savePassword, type PasswordState } from './actions';

/* Seeded here: a "use server" module may only export async functions. */
const INITIAL: PasswordState = { error: null, field: null, saved: false };

/**
 * Setting or changing the password.
 *
 * An account that has one must prove it before replacing it — a session left
 * open is not consent to change a credential. An account that has never had one
 * is not asked for something it cannot supply.
 */
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(
    savePassword,
    INITIAL,
  );
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const fieldError = (name: string) =>
    state.field === name ? state.error ?? undefined : undefined;

  return (
    <form action={action} className="stack">
      {hasPassword ? (
        <Field
          label="Current password"
          name="currentPassword"
          type="password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          error={fieldError('currentPassword')}
        />
      ) : null}

      <Field
        label={hasPassword ? 'New password' : 'Password'}
        name="newPassword"
        type="password"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        error={fieldError('newPassword')}
      />
      <Field
        label="Confirm password"
        name="confirmPassword"
        type="password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        error={fieldError('confirmPassword')}
      />

      {state.error && !state.field ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.saved ? (
        <p className="form-note" role="status">
          Password updated.
        </p>
      ) : null}

      <div className="form__actions">
        <button type="submit" className="button button--primary" disabled={pending}>
          {pending ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
        </button>
      </div>
    </form>
  );
}
