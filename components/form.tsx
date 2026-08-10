'use client';

import { useId, useState } from 'react';

interface FieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password';
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
}

export function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  autoComplete,
  placeholder,
  hint,
  error,
  required = true,
  disabled = false,
  maxLength,
  autoFocus = false,
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [revealed, setRevealed] = useState(false);

  const isPassword = type === 'password';
  const inputType = isPassword && revealed ? 'text' : type;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>

      <div className="field__control">
        <input
          id={id}
          name={name}
          className={`field__input${isPassword ? ' field__input--with-affix' : ''}`}
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          autoFocus={autoFocus}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
          spellCheck={false}
        />

        {isPassword && (
          <button
            type="button"
            className="field__affix"
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        )}
      </div>

      {error ? (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="field__hint" id={hintId}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

type AlertTone = 'error' | 'success' | 'info';

export function FormAlert({ tone = 'error', children }: { tone?: AlertTone; children: React.ReactNode }) {
  const toneClass = tone === 'error' ? '' : ` form-alert--${tone}`;
  return (
    <p className={`form-alert${toneClass}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

interface SubmitButtonProps {
  children: React.ReactNode;
  pending: boolean;
  pendingLabel: string;
  disabled?: boolean;
}

export function SubmitButton({ children, pending, pendingLabel, disabled }: SubmitButtonProps) {
  return (
    <button type="submit" className="button button--primary button--full" disabled={pending || disabled}>
      {pending && <span className="button__spinner" aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </button>
  );
}
