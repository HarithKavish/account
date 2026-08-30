'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration, WebAuthnError } from '@simplewebauthn/browser';

import type { Passkey } from '@/lib/account/passkeys';
import { deletePasskey } from './actions';

/**
 * Passkeys, listed and managed.
 *
 * The list is rendered by the server and re-fetched after every change, so what
 * is on screen is what the account holds rather than what this component last
 * believed.
 */
export function Passkeys({ passkeys }: { passkeys: Passkey[] }) {
  const router = useRouter();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Passkey | null>(null);
  const [removing, startRemoving] = useTransition();

  useEffect(() => {
    // The server cannot know, and a button that cannot work should not be shown.
    setSupported(
      typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined',
    );
  }, []);

  async function add() {
    if (adding) return;
    setAdding(true);
    setError(null);
    setNotice(null);

    try {
      const optionsResponse = await fetch('/api/auth/passkey/register/start', { method: 'POST' });
      if (!optionsResponse.ok) throw new Error('start_failed');

      const options = await optionsResponse.json();
      const credential = await startRegistration({ optionsJSON: options });

      const finish = await fetch('/api/auth/passkey/register/finish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(credential),
      });

      if (finish.status === 409) {
        setError('That passkey is already registered on this account.');
      } else if (!finish.ok) {
        setError('That passkey could not be verified. Please try again.');
      } else {
        setNotice('Passkey added.');
        router.refresh();
      }
    } catch (cause) {
      // Changing your mind is not an error worth reporting as one.
      const aborted =
        cause instanceof WebAuthnError
          ? cause.name === 'NotAllowedError' || cause.code === 'ERROR_CEREMONY_ABORTED'
          : cause instanceof Error && cause.name === 'NotAllowedError';

      if (!aborted) {
        console.error('[passkey] registration failed', cause);
        setError('Your device could not create a passkey.');
      }
    } finally {
      setAdding(false);
    }
  }

  function remove(passkey: Passkey) {
    startRemoving(async () => {
      const result = await deletePasskey(passkey.id);
      setConfirming(null);
      if (result.error) {
        setError(result.error);
      } else {
        setNotice('Passkey removed.');
        router.refresh();
      }
    });
  }

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <>
      <p className="group__lead">
        A passkey signs you in with your fingerprint, face, device PIN or a security key. The check
        happens on your device, and nothing about your fingerprint or face reaches this site.
      </p>

      {supported === false ? (
        <p className="form-note">This browser does not support passkeys.</p>
      ) : (
        <div className="form__actions">
          <button type="button" className="button button--primary" onClick={add} disabled={adding}>
            {adding ? 'Waiting for your device…' : 'Add a passkey'}
          </button>
        </div>
      )}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="form-note" role="status">
          {notice}
        </p>
      ) : null}

      {passkeys.length === 0 ? (
        <p className="group__lead group__lead--after">No passkeys yet.</p>
      ) : (
        <div className="rows">
          {passkeys.map((passkey) => (
            <div className="row" key={passkey.id}>
              <span className="row__label">{passkey.displayName}</span>
              <span className="row__value">
                Added {formatDate(passkey.createdAt)}
                <span className="row__note">
                  {passkey.lastUsedAt
                    ? `Last used ${formatDate(passkey.lastUsedAt)}`
                    : 'Not used yet'}
                  {passkey.backedUp ? ' · Synced across your devices' : ''}
                </span>
              </span>
              <span className="row__trailing">
                <button
                  type="button"
                  className="row__action row__action--danger"
                  onClick={() => setConfirming(passkey)}
                >
                  Remove
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Removal is irreversible, so it is asked rather than assumed. */}
      {confirming ? (
        <div className="notice" role="alertdialog" aria-label="Remove passkey?">
          <p className="notice__title">Remove passkey?</p>
          <p className="notice__body">
            Are you sure you want to remove <strong>{confirming.displayName}</strong>? You will no
            longer be able to use it to sign in.
          </p>
          <p className="notice__actions">
            <button
              type="button"
              className="button button--secondary button--slim"
              onClick={() => setConfirming(null)}
              disabled={removing}
            >
              No
            </button>{' '}
            <button
              type="button"
              className="button button--danger button--slim"
              onClick={() => remove(confirming)}
              disabled={removing}
            >
              {removing ? 'Removing…' : 'Yes, remove'}
            </button>
          </p>
        </div>
      ) : null}
    </>
  );
}
