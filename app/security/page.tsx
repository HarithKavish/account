'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { AccountLayout } from '@/components/account-layout';
import { useAuth } from '@/components/auth-provider';
import { Group, Row, UnavailablePill } from '@/components/rows';
import { getAuthBackend } from '@/lib/account/backend';
import type { AccountSession, Passkey } from '@/lib/account/types';

export default function SecurityPage() {
  const { capabilities, signOut } = useAuth();
  const router = useRouter();
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [sessions, setSessions] = useState<AccountSession[]>([]);

  // Read through the backend even though Phase 1 returns nothing, so these rows
  // start showing real data the moment Phases 3–4 land.
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

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <AppShell>
      <AccountLayout title="Security">
        <Group title="How you sign in">
          <Row
            label="Password"
            value={capabilities.realAuthentication ? 'Set' : 'Demonstration only'}
            trailing={capabilities.passwordChange ? undefined : <UnavailablePill />}
          />
          <Row
            label="Passkeys"
            value={passkeys.length > 0 ? `${passkeys.length} registered` : 'None'}
            trailing={capabilities.passkeys ? undefined : <UnavailablePill />}
          />
        </Group>

        {passkeys.length > 0 && (
          <Group title="Your passkeys">
            {passkeys.map((passkey) => (
              <Row
                key={passkey.id}
                label={passkey.label}
                value={`Added ${new Date(passkey.createdAt).toLocaleDateString()}`}
              />
            ))}
          </Group>
        )}

        <Group title="Sessions">
          {sessions.length > 0 ? (
            sessions.map((session) => (
              <Row
                key={session.id}
                label={session.client}
                value={`Last active ${new Date(session.lastSeenAt).toLocaleString()}`}
                trailing={session.current ? <span className="pill pill--active">This device</span> : undefined}
              />
            ))
          ) : (
            <Row
              label="Active sessions"
              value="Unavailable"
              note="This preview keeps your session in your own browser, so there is no server-side list."
              trailing={<UnavailablePill />}
            />
          )}
          <Row
            label="Sign out"
            value="On this device"
            trailing={
              <button type="button" className="row__action row__action--danger" onClick={handleSignOut}>
                Sign out
              </button>
            }
          />
        </Group>
      </AccountLayout>
    </AppShell>
  );
}
