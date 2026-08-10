'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/components/auth-provider';
import { BrandMark } from '@/components/brand';
import { Field, FormAlert, SubmitButton } from '@/components/form';
import { RedirectIfAuthenticated } from '@/components/route-guard';
import { readNextPath } from '@/lib/account/redirect';
import { validateSignIn, hasErrors, type FieldErrors } from '@/lib/account/validation';

function LoginForm() {
  const { signIn, capabilities } = useAuth();
  const router = useRouter();

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const input = { userId, password };
    const errors = validateSignIn(input);
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setPending(true);
    const result = await signIn(input);
    setPending(false);

    if (result.ok) {
      // Honours ?next= when it is a safe same-origin path, else /account.
      router.replace(readNextPath());
      return;
    }

    if (result.error.field) {
      setFieldErrors({ [result.error.field]: result.error.message });
    } else {
      setFormError(result.error.message);
    }
  }

  return (
    <>
      <div className="auth-brand">
        <BrandMark className="auth-brand__mark" />
      </div>

      <div className="auth-card">
        <div className="auth-card__head">
          <h1 className="auth-card__title">Sign in</h1>
          <p className="auth-card__lead">Use your HarithKavish Account.</p>
        </div>

        {formError && <FormAlert>{formError}</FormAlert>}

        <form className="form" onSubmit={handleSubmit} noValidate>
          <Field
            label="User ID"
            name="userId"
            value={userId}
            onChange={setUserId}
            autoComplete="username"
            placeholder="your-user-id"
            error={fieldErrors.userId}
            disabled={pending}
            autoFocus
          />

          <Field
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            error={fieldErrors.password}
            disabled={pending}
          />

          <div className="form__actions">
            <SubmitButton pending={pending} pendingLabel="Signing in…">
              Sign in
            </SubmitButton>
          </div>
        </form>

        <div className="auth-divider">or</div>

        <div className="form__actions">
          <Link className="button button--secondary button--full" href="/passkey">
            {capabilities.passkeys ? 'Use a passkey' : 'About passkey sign-in'}
          </Link>
        </div>

        <p className="auth-card__footer">
          New to HarithKavish? <Link href="/signup">Create an account</Link>
        </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <AppShell centered>
      <RedirectIfAuthenticated>
        <LoginForm />
      </RedirectIfAuthenticated>
    </AppShell>
  );
}
