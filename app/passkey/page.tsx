'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/components/auth-provider';
import { BrandMark } from '@/components/brand';
import { FormAlert } from '@/components/form';

/**
 * Passkey sign-in. The WebAuthn ceremony lands here in Phase 4; until then the
 * page states plainly that it is unavailable rather than simulating a
 * successful authentication.
 */
export default function PasskeyPage() {
  const { status, capabilities } = useAuth();
  const authenticated = status === 'authenticated';

  return (
    <AppShell centered>
      <div className="auth-brand">
        <BrandMark className="auth-brand__mark" />
      </div>

      <div className="auth-card">
        <div className="auth-card__head">
          <h1 className="auth-card__title">Sign in with a passkey</h1>
          <p className="auth-card__lead">Use your device instead of a password</p>
        </div>

        {!capabilities.passkeys && (
          <FormAlert tone="info">
            Passkeys are not available yet. They arrive once accounts are stored on a server.
          </FormAlert>
        )}

        <div className="form__actions">
          {authenticated ? (
            <Link className="button button--secondary button--full" href="/security">
              Back to Security
            </Link>
          ) : (
            <>
              <Link className="button button--primary button--full" href="/login">
                Use a password
              </Link>
              <Link className="button button--secondary button--full" href="/signup">
                Create an account
              </Link>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
