'use client';

import { useActionState } from 'react';

import { signInWithPassword, type LoginState } from './actions';

const initial: LoginState = { error: null };

/**
 * Two ways in, and they are not equivalent.
 *
 * Google is offered first because it is the one that needs nothing typed. The
 * password form is for accounts that chose a user ID — an account created
 * through Google has neither, and says so rather than failing silently.
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInWithPassword, initial);
  const googleHref = next
    ? `/api/auth/google/start?next=${encodeURIComponent(next)}`
    : '/api/auth/google/start';

  return (
    <div className="stack" style={{ maxWidth: '26rem', width: '100%' }}>
      <div className="section-head">
        <h1 className="section-head__title">Sign in</h1>
        <p className="section-head__lead">to your HarithKavish account</p>
      </div>

      <a className="button button--primary" href={googleHref}>
        Continue with Google
      </a>

      <p className="subtitle" style={{ textAlign: 'center' }}>
        or with a user ID
      </p>

      <form action={action} className="stack">
        <label className="field">
          <span>User ID</span>
          <input name="userId" autoComplete="username" required />
        </label>

        <label className="field">
          <span>Password</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>

        {state.error ? (
          <p role="alert" className="form-error">
            {state.error}
          </p>
        ) : null}

        <button type="submit" className="button" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="subtitle" style={{ textAlign: 'center' }}>
        No account? <a href="/signup">Create one</a>
      </p>
    </div>
  );
}
