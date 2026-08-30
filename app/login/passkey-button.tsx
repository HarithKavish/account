'use client';

import { useEffect, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { WebAuthnError } from '@simplewebauthn/browser';

/**
 * Signing in with a passkey.
 *
 * Nothing is typed first. The button asks the server for a challenge, hands it
 * to the browser, and the browser shows whatever passkeys it holds for this
 * domain — including ones on a phone, over the platform's own cross-device
 * mechanism. This page never learns what exists until one is offered.
 */
export function PasskeyButton({ next }: { next?: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Checked in an effect because the server cannot know, and a button that
    // cannot work should not be offered.
    setSupported(
      typeof window !== 'undefined' &&
        typeof window.PublicKeyCredential !== 'undefined',
    );
  }, []);

  async function signIn() {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      const optionsResponse = await fetch('/api/auth/passkey/authenticate/start', {
        method: 'POST',
      });
      if (!optionsResponse.ok) throw new Error('start_failed');

      const options = await optionsResponse.json();
      const assertion = await startAuthentication({ optionsJSON: options });

      const finish = await fetch('/api/auth/passkey/authenticate/finish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...assertion, next }),
      });

      if (!finish.ok) {
        setError('That passkey could not be verified. Try again, or sign in another way.');
        setPending(false);
        return;
      }

      const { next: destination } = (await finish.json()) as { next: string };
      // A full navigation, so the session cookie the server just set is the one
      // the next page is loaded with.
      window.location.href = destination;
    } catch (cause) {
      /*
       * Cancelling is not a failure.
       *
       * Dismissing the prompt, or letting it time out, raises the same error as
       * a genuine problem. Telling someone their passkey failed when they simply
       * changed their mind is how a working feature comes to look broken.
       */
      const aborted =
        cause instanceof WebAuthnError
          ? cause.name === 'NotAllowedError' || cause.code === 'ERROR_CEREMONY_ABORTED'
          : cause instanceof Error && cause.name === 'NotAllowedError';

      if (!aborted) {
        console.error('[passkey] sign-in failed', cause);
        const name = cause instanceof Error ? cause.name : '';
        // The error's name is not a secret and is the one thing that makes a
        // report from someone else's device actionable.
        setError(
          name
            ? `Your device could not complete the passkey check (${name}).`
            : 'Your device could not complete the passkey check.',
        );
      }
      setPending(false);
    }
  }

  if (supported === false) return null;

  return (
    <div className="stack">
      <button
        type="button"
        className="button button--secondary button--full"
        onClick={signIn}
        disabled={pending}
      >
        {pending ? 'Waiting for your device…' : 'Sign in with a passkey'}
      </button>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
