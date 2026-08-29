/**
 * Shown when the handoff from the auth host ran and left no session behind.
 *
 * Reached only after an adoption attempt — see `lib/auth/require.ts`. Sending
 * someone back to sign in again would send them straight back here, so this says
 * what happened instead and offers the front door as a choice rather than as a
 * redirect.
 */
export function SignInUnavailable() {
  return (
    <div className="pending" role="alert">
      <p className="pending__title">We could not keep you signed in</p>
      <p className="pending__body">
        You signed in, but this site could not store the session — usually because the browser is
        blocking cookies for <strong>account.harithkavish.com</strong>. Allow cookies for this site
        and try again.
      </p>
      <p className="form__actions">
        <a className="button button--primary" href="https://auth.harithkavish.com/">
          Back to sign in
        </a>
      </p>
    </div>
  );
}
