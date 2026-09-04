'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/brand';
import { Field, FormAlert, SubmitButton } from '@/components/form';
import { authPlatform } from '@/lib/config/site';
import { createAccountAction, type SignupSuccess } from './actions';
import {
  PASSWORD_MIN,
  USER_ID_MAX,
  hasErrors,
  passwordStrength,
  validateCreateAccount,
  type FieldErrors,
} from '@/lib/account/validation';

const STRENGTH_LABEL = {
  short: `Use at least ${PASSWORD_MIN} characters.`,
  weak: 'Long enough. A longer phrase is stronger than added symbols.',
  fair: 'Good.',
  strong: 'Strong.',
} as const;

/** Shown once the account genuinely exists in the database. */
function Created({ account }: { account: SignupSuccess }) {
  return (
    <div className="auth-card">
      <div className="auth-card__head">
        <h1 className="auth-card__title">Your account has been created</h1>
        <p className="auth-card__lead">
          Welcome, {account.firstName}. Your user ID is <code>{account.userId}</code>.
        </p>
      </div>

      <FormAlert tone="info">
        Signing in to HarithKavish services is handled by {authPlatform.name} at{' '}
        <strong>{authPlatform.domain}</strong>, not here. This site is where you manage the account
        itself.
      </FormAlert>

      <div className="form__actions">
        <Link className="button button--secondary button--full" href="/account">
          Manage your account
        </Link>
      </div>
    </div>
  );
}

export function SignupForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<SignupSuccess | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const input = { firstName, lastName, email, userId, password, confirmPassword };

    // Fast feedback only. The server runs the same rules authoritatively.
    const errors = validateCreateAccount(input);
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    const formData = new FormData();
    Object.entries(input).forEach(([key, value]) => formData.append(key, value));

    setPending(true);
    const result = await createAccountAction(formData);
    setPending(false);

    if (result.status === 'success') {
      // Clear the passwords from component state the moment they are no longer
      // needed.
      setPassword('');
      setConfirmPassword('');
      setCreated(result.account);
      return;
    }

    if (result.status === 'error') {
      if (result.error.field) {
        setFieldErrors({ [result.error.field]: result.error.message });
      } else {
        setFormError(result.error.message);
      }
    }
  }

  if (created) {
    return (
      <>
        <div className="auth-brand">
          <BrandMark className="auth-brand__mark" />
        </div>
        <Created account={created} />
      </>
    );
  }

  const strength = password ? passwordStrength(password) : null;

  return (
    <>
      <div className="auth-brand">
        <BrandMark className="auth-brand__mark" />
      </div>

      <div className="auth-card">
        <div className="auth-card__head">
          <h1 className="auth-card__title">Create your HarithKavish Account</h1>
          <p className="auth-card__lead">
            Your HarithKavish Account is used across HarithKavish platforms and services.
          </p>
        </div>

        {formError && <FormAlert>{formError}</FormAlert>}

        <form className="form" onSubmit={handleSubmit} noValidate>
          <div className="form__row">
            <Field
              label="First name"
              name="firstName"
              value={firstName}
              onChange={setFirstName}
              autoComplete="given-name"
              error={fieldErrors.firstName}
              disabled={pending}
              autoFocus
            />
            <Field
              label="Last name"
              name="lastName"
              value={lastName}
              onChange={setLastName}
              autoComplete="family-name"
              error={fieldErrors.lastName}
              disabled={pending}
            />
          </div>

          <Field
            label="Email"
            name="email"
            type="text"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            error={fieldErrors.email}
            disabled={pending}
            hint="Used to recognise you when you sign in with another service."
          />

          <Field
            label="User ID"
            name="userId"
            value={userId}
            onChange={setUserId}
            autoComplete="username"
            placeholder="your-user-id"
            hint="This is how you sign in. An email address works too. Saved in lowercase."
            error={fieldErrors.userId}
            disabled={pending}
            maxLength={USER_ID_MAX}
          />

          <Field
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            hint={strength ? STRENGTH_LABEL[strength] : `At least ${PASSWORD_MIN} characters.`}
            error={fieldErrors.password}
            disabled={pending}
          />

          <Field
            label="Confirm password"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            error={fieldErrors.confirmPassword}
            disabled={pending}
          />

          <div className="form__actions">
            <SubmitButton pending={pending} pendingLabel="Creating account…">
              Create account
            </SubmitButton>
          </div>
        </form>

        <p className="auth-card__footer">
          Signing in happens at {authPlatform.domain}, not here.
        </p>
      </div>
    </>
  );
}
