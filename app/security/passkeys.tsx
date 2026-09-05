'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startRegistration, WebAuthnError } from '@simplewebauthn/browser';

import type { Passkey } from '@/lib/account/passkeys';
import { useWebAuthnSupport } from '@/lib/hooks/use-webauthn-support';
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
  const supported = useWebAuthnSupport();
  /** Whether this device has a passkey manager of its own. Null until asked. */
  const [platformAvailable, setPlatformAvailable] = useState<boolean | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Passkey | null>(null);
  const [removing, startRemoving] = useTransition();

  useEffect(() => {
    if (!supported) return;

    /*
     * Asked on load, and shown on the page.
     *
     * This single fact decides which prompt a browser puts up, and while it was
     * invisible the only way to learn it was to ask someone to describe a dialog
     * they were looking at. A device that answers no here is precisely why a
     * browser offers a security key and another device instead of itself.
     */
    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then(setPlatformAvailable)
      .catch(() => setPlatformAvailable(null));
  }, [supported]);

  async function add() {
    if (adding) return;
    setAdding(true);
    setError(null);
    setNotice(null);

    try {
      let isPlatform = platformAvailable;
      if (isPlatform === null && typeof window !== 'undefined' && window.PublicKeyCredential) {
        try {
          isPlatform = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setPlatformAvailable(isPlatform);
        } catch {
          isPlatform = null;
        }
      }

      const optionsResponse = await fetch('/api/auth/passkey/register/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platformAvailable: isPlatform !== false }),
      });
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
      const name = cause instanceof Error ? cause.name : '';
      const code = cause instanceof WebAuthnError ? cause.code : '';

      /*
       * `NotAllowedError` covers three different things: cancelling, timing out,
       * and a device deciding it had nothing to offer. They are
       * indistinguishable from here, so the message says what is true of all
       * three rather than picking one and being wrong most of the time.
       *
       * Staying silent was worse: someone whose device simply offered nothing
       * saw a button that appeared to do nothing at all.
       */
      if (name === 'NotAllowedError' || code === 'ERROR_CEREMONY_ABORTED') {
        setError(
          'No passkey was created. If you did not cancel, your device may not have offered one.',
        );
      } else if (name === 'InvalidStateError') {
        setError('This device already has a passkey for your account.');
      } else {
        console.error('[passkey] registration failed', cause);
        // Show the full error message from the platform (e.g. Android Credential
        // Manager) so we can diagnose exactly what is failing.
        const msg = cause instanceof Error ? cause.message : '';
        const causeMsg =
          cause instanceof Error && cause.cause instanceof Error
            ? cause.cause.message
            : '';
        const detail = [name, msg, causeMsg].filter(Boolean).join(' — ');
        setError(
          detail
            ? `Passkey creation failed: ${detail}`
            : 'Your device could not create a passkey.',
        );
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

      {/* What the device reported about itself, and what to do about it. */}
      {supported && platformAvailable === false ? (
        <p className="form-note">
          This device has no passkey manager of its own, so you will be offered a security key or
          another device instead. On Android, saving a passkey here needs a screen lock (PIN, pattern, or biometric) and a Google account signed in on the device.
        </p>
      ) : null}

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
