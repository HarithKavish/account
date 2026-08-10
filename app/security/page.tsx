'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/components/auth-provider';
import { RequireAuth } from '@/components/route-guard';
import { getAuthBackend } from '@/lib/account/backend';
import type { AccountSession, Passkey } from '@/lib/account/types';

function SecurityContent() {
  const { capabilities } = useAuth();
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [sessions, setSessions] = useState<AccountSession[]>([]);

  // Read through the backend even though Phase 1 returns nothing, so these
  // panels start rendering real data the moment Phases 3–4 land.
  useEffect(() => {
    const backend = getAuthBackend();
    let active = true;
    void Promise.all([backend.listPasskeys(), backend.listSessions()]).then(([keys, live]) => {
      if (!active) return;
      setPasskeys(keys);
      setSessions(live);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <section className="page-head">
        <p className="page-head__eyebrow">Security</p>
        <h1 className="page-head__title">How you sign in</h1>
        <p className="page-head__lead">
          Your password, your passkeys, and the devices signed in to your account.
        </p>
      </section>

      <div className="stack">
        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Password</h2>
            {capabilities.passwordChange ? (
              <span className="pill pill--active">Available</span>
            ) : (
              <span className="pill pill--planned">Not yet available</span>
            )}
          </div>

          {capabilities.realAuthentication ? (
            <p className="panel__body">
              Your password is stored only as a hash and is never shown back to you.
            </p>
          ) : (
            <p className="panel__body">
              Sign-in on this preview build is a local demonstration, so there is no stored password
              to change. Changing your password becomes available once real authentication is in
              place.
            </p>
          )}

          <div className="empty-state">
            <p className="empty-state__title">Change password</p>
            <p className="empty-state__body">
              Arrives with real authentication. It will ask for your current password before
              accepting a new one.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Passkeys</h2>
            {capabilities.passkeys ? (
              <span className="pill pill--active">{passkeys.length} registered</span>
            ) : (
              <span className="pill pill--planned">Not yet available</span>
            )}
          </div>

          <p className="panel__body">
            Passkeys let you sign in with your device instead of a password. Your account can hold
            more than one — for example a laptop and a phone.
          </p>

          {passkeys.length > 0 ? (
            <div>
              {passkeys.map((passkey) => (
                <div className="service-row" key={passkey.id}>
                  <div className="service-row__text">
                    <p className="service-row__name">{passkey.label}</p>
                    <p className="service-row__desc">
                      Added {new Date(passkey.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="pill pill--active">Active</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p className="empty-state__title">No passkeys yet</p>
              <p className="empty-state__body">
                {capabilities.passkeys
                  ? 'Add a passkey to sign in without typing a password.'
                  : 'Registering a passkey needs a real account to attach it to, so this arrives after authentication is built.'}
              </p>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Active sessions</h2>
            {capabilities.sessionManagement ? (
              <span className="pill pill--active">{sessions.length} active</span>
            ) : (
              <span className="pill pill--planned">Not yet available</span>
            )}
          </div>

          <p className="panel__body">
            Where your account is currently signed in, with the ability to sign out everywhere
            else.
          </p>

          {sessions.length > 0 ? (
            <div>
              {sessions.map((session) => (
                <div className="service-row" key={session.id}>
                  <div className="service-row__text">
                    <p className="service-row__name">{session.client}</p>
                    <p className="service-row__desc">
                      Last active {new Date(session.lastSeenAt).toLocaleString()}
                    </p>
                  </div>
                  {session.current ? (
                    <span className="pill pill--active">This device</span>
                  ) : (
                    <span className="pill pill--neutral">Signed in</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p className="empty-state__title">Session list unavailable</p>
              <p className="empty-state__body">
                This preview keeps your demo session in your own browser, so there is no server-side
                session list to show. Real sessions appear here once they exist.
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default function SecurityPage() {
  return (
    <AppShell>
      <RequireAuth>
        <SecurityContent />
      </RequireAuth>
    </AppShell>
  );
}
