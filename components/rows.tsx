'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { ChevronIcon } from './icons';

/** A titled block of rows. Titles are structural, not editorial. */
export function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="group">
      {title && <h2 className="group__title">{title}</h2>}
      <div className="rows">{children}</div>
    </section>
  );
}

interface RowProps {
  label: string;
  value?: React.ReactNode;
  /** Right-hand control: a button, pill, or nothing. */
  trailing?: React.ReactNode;
  /** Rendered under the value when a state genuinely needs explaining. */
  note?: string;
}

export function Row({ label, value, trailing, note }: RowProps) {
  return (
    <div className="row">
      <span className="row__label">{label}</span>
      <span className="row__value">
        {value ?? <span className="row__empty">Not set</span>}
        {note && <span className="row__note">{note}</span>}
      </span>
      <span className="row__trailing">{trailing}</span>
    </div>
  );
}

export function LinkRow({
  label,
  value,
  href,
  note,
}: {
  label: string;
  value?: React.ReactNode;
  href: string;
  note?: string;
}) {
  return (
    <Link className="row row--link" href={href}>
      <span className="row__label">{label}</span>
      <span className="row__value">
        {value}
        {note && <span className="row__note">{note}</span>}
      </span>
      <span className="row__trailing">
        <ChevronIcon />
      </span>
    </Link>
  );
}

interface EditableRowProps {
  label: string;
  value: string;
  autoComplete?: string;
  /** Returns an error message, or null when the save succeeded. */
  onSave: (next: string) => Promise<string | null>;
}

/**
 * A row that swaps into an input in place. Keeps editing where the value lives
 * rather than sending the user to a separate form.
 */
export function EditableRow({ label, value, autoComplete, onSave }: EditableRowProps) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function begin() {
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const message = await onSave(draft);
    setPending(false);

    if (message) {
      setError(message);
      return;
    }
    setEditing(false);
  }

  if (!editing) {
    return (
      <Row
        label={label}
        value={value}
        trailing={
          <button type="button" className="row__action" onClick={begin}>
            Edit
          </button>
        }
      />
    );
  }

  return (
    <form className="row row--editing" onSubmit={save} noValidate>
      <label className="row__label" htmlFor={id}>
        {label}
      </label>
      <span className="row__value">
        <input
          id={id}
          className="row__input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : undefined}
          disabled={pending}
          autoFocus
        />
        {error && <span className="row__error">{error}</span>}
      </span>
      <span className="row__trailing row__trailing--actions">
        <button type="button" className="row__action" onClick={cancel} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className="row__action row__action--primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </span>
    </form>
  );
}

/** States the platform genuinely cannot do yet. Never dressed up as working. */
export function UnavailablePill({ children = 'Not available yet' }: { children?: string }) {
  return <span className="pill pill--planned">{children}</span>;
}
