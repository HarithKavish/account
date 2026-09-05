'use client';

import { useActionState, useState } from 'react';

import { Avatar } from '@/components/avatar';
import { PencilIcon } from '@/components/icons';
import { savePictureSource, type FieldState } from './actions';

/* Seeded here: a "use server" module may only export async functions. */
const INITIAL: FieldState = { error: null, saved: false };

export interface PictureChoice {
  /** 'none' is the placeholder, and is always offered. */
  id: string;
  label: string;
  src: string | null;
}

/**
 * Choosing which connected account lends this one its picture.
 *
 * The account never owns a picture — it borrows one, or shows the placeholder.
 * So "None" is a real choice sitting first among equals rather than a way of
 * clearing something, and it stays available precisely so a borrowed picture can
 * be given back.
 */
export function PictureEditor({
  current,
  choices,
}: {
  current: string;
  choices: PictureChoice[];
}) {
  const [state, action, pending] = useActionState<FieldState, FormData>(
    savePictureSource,
    INITIAL,
  );
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(current);

  // See inline-field.tsx for why this runs during render rather than in an
  // effect: each is a one-time reaction to a transition (a save landing, the
  // source account's picture changing underneath), and comparing against the
  // previous value while rendering does that in the same pass.
  const [prevSaved, setPrevSaved] = useState(state.saved);
  if (state.saved !== prevSaved) {
    setPrevSaved(state.saved);
    if (state.saved) setEditing(false);
  }

  const [prevCurrent, setPrevCurrent] = useState(current);
  if (current !== prevCurrent) {
    setPrevCurrent(current);
    setSelected(current);
  }

  const shown = choices.find((choice) => choice.id === current) ?? choices[0];
  const changed = selected !== current;

  if (!editing) {
    return (
      <div className="picture">
        <Avatar src={shown?.src ?? null} size={84} />
        <button
          type="button"
          className="icon-button"
          onClick={() => setEditing(true)}
          aria-label="Edit profile picture"
        >
          <PencilIcon />
          <span>Edit</span>
        </button>
      </div>
    );
  }

  return (
    <form className="picture picture--editing" action={action}>
      <input type="hidden" name="source" value={selected} />

      <div className="picture__choices" role="radiogroup" aria-label="Profile picture">
        {choices.map((choice) => (
          <button
            type="button"
            key={choice.id}
            role="radio"
            aria-checked={selected === choice.id}
            className={`picture__choice${selected === choice.id ? ' is-selected' : ''}`}
            onClick={() => setSelected(choice.id)}
          >
            <Avatar src={choice.src} size={64} />
            <span className="picture__choice-label">{choice.label}</span>
          </button>
        ))}
      </div>

      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="form__actions">
        <button type="submit" className="button button--primary button--slim" disabled={!changed || pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="button button--secondary button--slim"
          onClick={() => {
            setSelected(current);
            setEditing(false);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
