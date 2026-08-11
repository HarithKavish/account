'use client';

import { AppShell } from '@/components/app-shell';
import { AccountLayout } from '@/components/account-layout';
import { useAuth } from '@/components/auth-provider';
import { EditableRow, Group, Row } from '@/components/rows';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function PersonalInfoPage() {
  const { user, updateProfile } = useAuth();

  return (
    <AppShell>
      <AccountLayout title="Personal info">
        {user && (
          <>
            <Group title="Basic info">
              <EditableRow
                label="First name"
                value={user.firstName}
                autoComplete="given-name"
                onSave={async (next) => {
                  const result = await updateProfile({ firstName: next, lastName: user.lastName });
                  return result.ok ? null : result.error.message;
                }}
              />
              <EditableRow
                label="Last name"
                value={user.lastName}
                autoComplete="family-name"
                onSave={async (next) => {
                  const result = await updateProfile({ firstName: user.firstName, lastName: next });
                  return result.ok ? null : result.error.message;
                }}
              />
            </Group>

            <Group title="Identity">
              <Row label="User ID" value={<code>{user.userId}</code>} note="How you sign in." />
              <Row label="Created" value={formatDate(user.createdAt)} />
            </Group>
          </>
        )}
      </AccountLayout>
    </AppShell>
  );
}
