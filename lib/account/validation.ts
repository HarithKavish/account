/**
 * Shared validation rules.
 *
 * These are deliberately backend-agnostic: Phase 3 will run the very same
 * functions server-side, where they become the authoritative check. Client-side
 * use is purely for fast feedback and is never the security boundary.
 */

import type { AuthError, SignInInput, SignUpInput } from './types';

export const USER_ID_MIN = 3;
export const USER_ID_MAX = 32;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 60;

/** Letters, digits, dot, dash, underscore. Must start with a letter or digit. */
const USER_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

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
    return 'Use letters, numbers, dots, dashes and underscores, starting with a letter or number.';
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

export function validateSignUp(input: SignUpInput): FieldErrors {
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

export function validateSignIn(input: SignInInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.userId.trim()) errors.userId = 'Enter your user ID.';
  if (!input.password) errors.password = 'Enter your password.';
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
export function toValidationError(errors: FieldErrors): AuthError {
  const [field, message] = Object.entries(errors)[0] ?? ['form', 'Check the form and try again.'];
  return { code: 'validation_failed', message, field };
}

/** Coarse strength signal for the signup form. Not a security control. */
export function passwordStrength(password: string): 'weak' | 'fair' | 'strong' {
  if (password.length < PASSWORD_MIN) return 'weak';
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
  if (password.length >= 16 && classes >= 3) return 'strong';
  if (classes >= 3 || password.length >= 14) return 'fair';
  return 'weak';
}
