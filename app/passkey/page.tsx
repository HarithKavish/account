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
          <p className="auth-card__lead">
            A passkey lets you sign in with your device — fingerprint, face or screen lock —
            instead of typing a password. The private key never leaves your device and is never
            sent to us.
          </p>
        </div>

        {!capabilities.passkeys && (
          <FormAlert tone="info">
            Passkeys are not available yet. This platform has to store real accounts before it can
            register credentials against them, so passkey support arrives after sign-in becomes
            real.
          </FormAlert>
        )}

        <div className="stack">
          <div className="empty-state">
            <p className="empty-state__title">What will work here</p>
            <p className="empty-state__body">
              You will be able to add one or more passkeys from the Security page, then use any of
              them to sign in on that device. Multiple passkeys per account are supported by
              design, so a phone and a laptop can each have their own.
            </p>
          </div>
        </div>

        <div className="form__actions">
          {authenticated ? (
            <>
              <Link className="button button--primary button--full" href="/security">
                Go to Security
              </Link>
              <Link className="button button--secondary button--full" href="/account">
                Back to your account
              </Link>
            </>
          ) : (
            <>
              <Link className="button button--primary button--full" href="/login">
                Sign in with a password
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
