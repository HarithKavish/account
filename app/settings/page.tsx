'use client';

import { AppShell } from '@/components/app-shell';
import { AccountLayout } from '@/components/account-layout';
import { Group, Row } from '@/components/rows';
import { ThemeToggle } from '@/components/theme-toggle';

export default function PreferencesPage() {
  return (
    <AppShell>
      <AccountLayout title="Preferences">
        <Group title="Appearance">
          <Row
            label="Theme"
            value="Follows your system until you choose"
            trailing={<ThemeToggle />}
          />
        </Group>
      </AccountLayout>
    </AppShell>
  );
}
