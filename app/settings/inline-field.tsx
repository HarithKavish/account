'use client';

import { useActionState, useEffect, useState } from 'react';

import { PencilIcon } from '@/components/icons';
import { saveNameField, type FieldState } from './actions';

/* Seeded here: a "use server" module may only export async functions. */
const INITIAL: FieldState = { error: null, saved: false };

/**
 * A detail that is shown, not a form that happens to be filled in.
 *
 * Reading an account is the common case and editing it is the rare one, so the
 * resting state is plain text and the pencil is the only affordance. The input
 * appears when asked for and goes away again when the edit is finished.
 *
 * Save stays disabled until the value actually differs: a Save that does nothing
 * is a question the person cannot answer — did it work, or was there nothing to
 * do? Cancel is always available, because leaving must never be blocked.
 */
export function InlineField({
  label,
  field,
  value,
}: {
  label: string;
  field: 'firstName' | 'lastName';
  value: string;
}) {
  const [state, action, pending] = useActionState<FieldState, FormData>(saveNameField, INITIAL);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // The server is the authority on what was saved. When it confirms, the edit is
  // over; when the value changes underneath, the draft follows it.
  useEffect(() => {
    if (state.saved) setEditing(false);
  }, [state.saved]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const changed = draft.trim() !== value.trim();

  if (!editing) {
    return (
      <div className="row">
        <span className="row__label">{label}</span>
        <span className="row__value">{value || <span className="row__empty">Not set</span>}</span>
        <span className="row__trailing">
          <button
            type="button"
            className="icon-button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${label.toLowerCase()}`}
          >
            <PencilIcon />
          </button>
        </span>
      </div>
    );
  }

  return (
    <form className="row row--editing" action={action}>
      <input type="hidden" name="field" value={field} />
      <label className="row__label" htmlFor={`field-${field}`}>
        {label}
      </label>
      <span className="row__value">
        <input
          id={`field-${field}`}
          className="field__input"
          name="value"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoFocus
          disabled={pending}
        />
        {state.error ? (
          <span className="row__error" role="alert">
            {state.error}
          </span>
        ) : null}
      </span>
      <span className="row__trailing row__trailing--actions">
        <button type="submit" className="button button--primary button--slim" disabled={!changed || pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="button button--secondary button--slim"
          onClick={() => {
            setDraft(value);
            setEditing(false);
          }}
        >
          Cancel
        </button>
      </span>
    </form>
  );
}
