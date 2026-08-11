/**
 * Shared validation rules.
 *
 * The same functions run on the server, where they are the authoritative
 * check, and in the browser purely for fast feedback. Client-side validation
 * is never the security boundary.
 */

import type { AccountError, CreateAccountInput } from './types';

export const USER_ID_MIN = 3;
/** Long enough that an email address can be used as the login identity. */
export const USER_ID_MAX = 64;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 60;

/**
 * Letters, digits, and . _ - + @ — which permits email-style identities as well
 * as plain handles. Must start with a letter or digit so an ID can never be
 * confused with a flag or a path segment.
 */
const USER_ID_PATTERN = /^[a-z0-9][a-z0-9._+@-]*$/;

export type FieldErrors = Record<string, string>;

/** User IDs are stored and compared in a single canonical casing. */
export function normalizeUserId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function validateUserId(raw: string): string | null {
  const value = normalizeUserId(raw);
  if (!value) return 'Enter a user ID.';
  if (value.length < USER_ID_MIN) return `Use at least ${USER_ID_MIN} characters.`;
  if (value.length > USER_ID_MAX) return `Use at most ${USER_ID_MAX} characters.`;
  if (!USER_ID_PATTERN.test(value)) {
    return 'Use letters, numbers and . _ - + @ only, starting with a letter or number.';
  }
  return null;
}

function validateName(raw: string, label: string): string | null {
  const value = normalizeName(raw);
  if (!value) return `Enter your ${label}.`;
  if (value.length > NAME_MAX) return `Use at most ${NAME_MAX} characters.`;
  return null;
}

function validatePassword(raw: string): string | null {
  if (!raw) return 'Enter a password.';
  if (raw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (raw.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  return null;
}

export function validateCreateAccount(input: CreateAccountInput): FieldErrors {
  const errors: FieldErrors = {};

  const firstName = validateName(input.firstName, 'first name');
  if (firstName) errors.firstName = firstName;

  const lastName = validateName(input.lastName, 'last name');
  if (lastName) errors.lastName = lastName;

  const userId = validateUserId(input.userId);
  if (userId) errors.userId = userId;

  const password = validatePassword(input.password);
  if (password) errors.password = password;

  if (!input.confirmPassword) {
    errors.confirmPassword = 'Re-enter your password.';
  } else if (input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export function validateProfile(input: { firstName: string; lastName: string }): FieldErrors {
  const errors: FieldErrors = {};
  const firstName = validateName(input.firstName, 'first name');
  if (firstName) errors.firstName = firstName;
  const lastName = validateName(input.lastName, 'last name');
  if (lastName) errors.lastName = lastName;
  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Turns the first field error into the standard error envelope. */
export function toValidationError(errors: FieldErrors): AccountError {
  const [field, message] = Object.entries(errors)[0] ?? ['form', 'Check the form and try again.'];
  return { code: 'validation_failed', message, field };
}

/**
 * Coarse strength signal for the signup form. Advisory only — length is the
 * single thing that actually gates submission, so `short` is kept distinct from
 * `weak` rather than collapsing both into one misleading message.
 */
export type PasswordStrength = 'short' | 'weak' | 'fair' | 'strong';

export function passwordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN) return 'short';
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
  if (password.length >= 16 && classes >= 3) return 'strong';
  if (classes >= 3 || password.length >= 14) return 'fair';
  return 'weak';
}
