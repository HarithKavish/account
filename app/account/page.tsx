'use client';

import { AppShell } from '@/components/app-shell';
import { AccountLayout } from '@/components/account-layout';
import { useAuth } from '@/components/auth-provider';
import { Group, LinkRow, Row } from '@/components/rows';
import { initials } from '@/components/user-menu';

export default function AccountHomePage() {
  const { user } = useAuth();

  return (
    <AppShell>
      <AccountLayout title="Home">
        {user && (
          <>
            <div className="identity">
              <span className="avatar avatar--lg" aria-hidden="true">
                {initials(user)}
              </span>
              <span className="identity__text">
                <span className="identity__name">
                  {user.firstName} {user.lastName}
                </span>
                <span className="identity__id">{user.userId}</span>
              </span>
            </div>

            <Group title="Your account">
              <LinkRow label="Personal info" value="Name and user ID" href="/personal-info" />
              <LinkRow label="Data & privacy" value="What this account stores" href="/privacy" />
              <LinkRow label="Security" value="Password and passkeys" href="/security" />
              <LinkRow label="Preferences" value="Appearance" href="/settings" />
            </Group>

            <Group title="Status">
              <Row label="Account" value="Active" />
              <Row
                label="Connected products"
                value="None"
                note="Signing in to HarithKavish products with this account is not built yet."
              />
            </Group>
          </>
        )}
      </AccountLayout>
    </AppShell>
  );
}
