'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/components/auth-provider';
import { BrandMark } from '@/components/brand';
import { Field, FormAlert, SubmitButton } from '@/components/form';
import { RedirectIfAuthenticated } from '@/components/route-guard';
import {
  PASSWORD_MIN,
  USER_ID_MAX,
  hasErrors,
  passwordStrength,
  validateSignUp,
  type FieldErrors,
} from '@/lib/account/validation';

const STRENGTH_LABEL = {
  weak: 'Too short — use at least 10 characters.',
  fair: 'Reasonable. Longer is better than more symbols.',
  strong: 'Strong.',
} as const;

function SignupForm() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const input = { firstName, lastName, userId, password, confirmPassword };
    const errors = validateSignUp(input);
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setPending(true);
    const result = await signUp(input);
    setPending(false);

    if (result.ok) {
      router.replace('/account');
      return;
    }

    if (result.error.field) {
      setFieldErrors({ [result.error.field]: result.error.message });
    } else {
      setFormError(result.error.message);
    }
  }

  const strength = password ? passwordStrength(password) : null;

  return (
    <>
      <div className="auth-brand">
        <BrandMark className="auth-brand__mark" />
      </div>

      <div className="auth-card">
        <div className="auth-card__head">
          <h1 className="auth-card__title">Create your account</h1>
          <p className="auth-card__lead">One HarithKavish Account for HarithKavish products</p>
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
            label="User ID"
            name="userId"
            value={userId}
            onChange={setUserId}
            autoComplete="username"
            placeholder="your-user-id"
            hint={`This is how you sign in. Letters, numbers, dots, dashes and underscores, up to ${USER_ID_MAX} characters.`}
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
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </>
  );
}

export default function SignupPage() {
  return (
    <AppShell centered>
      <RedirectIfAuthenticated>
        <SignupForm />
      </RedirectIfAuthenticated>
    </AppShell>
  );
}
