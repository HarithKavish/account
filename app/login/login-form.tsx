'use client';

import { useActionState } from 'react';

import { signInWithPassword, type LoginState } from './actions';

const initial: LoginState = { error: null };

/**
 * The ecosystem's front door.
 *
 * Order is deliberate. A HarithKavish account is the identity, so the form for
 * one comes first. Creating an account is the next thing someone without one
 * needs. Google is last, and it is a way of proving a HarithKavish account
 * rather than an alternative to having one — which is why every surface sends
 * people here rather than to Google directly.
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInWithPassword, initial);

  const withNext = (path: string) =>
    next ? `${path}?next=${encodeURIComponent(next)}` : path;

  /* Creating an account is the account host's job, and this page is served on
     the auth host. An absolute address means the link is right from either. */
  const createAccountUrl = withNext('https://account.harithkavish.com/create_account');

  return (
    <div className="stack" style={{ maxWidth: '26rem', width: '100%' }}>
      <div className="section-head">
        <h1 className="section-head__title">Sign in to Nexus</h1>
        <p className="section-head__lead">
          One account for everything on harithkavish.com.
        </p>
      </div>

      <form action={action} className="stack">
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <label className="field">
          <span>User ID</span>
          <input name="userId" autoComplete="username" required autoFocus />
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

        <button type="submit" className="button button--primary" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="subtitle" style={{ textAlign: 'center' }}>
        New user?{' '}
        <a href={createAccountUrl}>Create account</a>
      </p>

      <div className="login-divider" role="separator">
        <span>or</span>
      </div>

      <a className="button button--secondary" href={withNext('/api/auth/google/start')}>
        Sign in with Google
      </a>
    </div>
  );
}
