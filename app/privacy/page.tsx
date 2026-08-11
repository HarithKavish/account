'use client';

import { AppShell } from '@/components/app-shell';
import { AccountLayout } from '@/components/account-layout';
import { useAuth } from '@/components/auth-provider';
import { Group, Row, UnavailablePill } from '@/components/rows';

export default function PrivacyPage() {
  const { user } = useAuth();

  return (
    <AppShell>
      <AccountLayout title="Data & privacy">
        {user && (
          <>
            <Group title="What this account stores">
              <Row label="Name" value={`${user.firstName} ${user.lastName}`} />
              <Row label="User ID" value={<code>{user.userId}</code>} />
              <Row label="Password" value="Stored as a one-way hash" />
              <Row label="Passkeys" value="None" />
            </Group>

            <Group title="What it never collects">
              <Row label="Phone number" value="Not collected" />
              <Row label="Address" value="Not collected" />
              <Row label="Date of birth" value="Not collected" />
              <Row label="Payment details" value="Not collected" />
            </Group>

            <Group title="Your data">
              <Row label="Download your data" trailing={<UnavailablePill />} />
              <Row label="Delete your account" trailing={<UnavailablePill />} />
            </Group>
          </>
        )}
      </AccountLayout>
    </AppShell>
  );
}
