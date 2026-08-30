import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';

import { AppShell } from '@/components/app-shell';
import { AccountLayout } from '@/components/account-layout';
import { ProviderProfile } from '@/components/provider-profile';
import { SignInUnavailable } from '@/components/sign-in-unavailable';
import { ThemeToggle } from '@/components/theme-toggle';
import { listConnections } from '@/lib/account/connections';
import { requireAccount } from '@/lib/auth/require';
import { getDb, schema } from '@/lib/db/client';
import { InlineField } from './inline-field';
import { PictureEditor, type PictureChoice } from './picture-editor';

export const metadata: Metadata = { title: 'Profile' };

export const dynamic = 'force-dynamic';

/** Profile. The fields shown are exactly what the `users` table stores. */
export default async function ProfilePage() {
  const account = await requireAccount();
  if (!account) {
    return (
      <AppShell>
        <AccountLayout title="Profile">
          <SignInUnavailable />
        </AccountLayout>
      </AppShell>
    );
  }

  const db = getDb();
  const [connections, sourceRow] = await Promise.all([
    listConnections(account.id),
    db
      .select({ source: schema.users.pictureSource })
      .from(schema.users)
      .where(eq(schema.users.id, account.id))
      .limit(1),
  ]);

  // The placeholder is always offered; a provider only once it is connected and
  // has actually given us a picture.
  const choices: PictureChoice[] = [
    { id: 'none', label: 'None', src: null },
    ...connections
      .filter((connection) => connection.connected && connection.picture)
      .map((connection) => ({
        id: connection.id,
        label: connection.label,
        src: connection.picture,
      })),
  ];

  const stored = sourceRow[0]?.source ?? 'none';
  // A source whose provider has gone away resolves to the placeholder rather
  // than to a selection the picker cannot show.
  const current = choices.some((choice) => choice.id === stored) ? stored : 'none';

  const created = new Date(account.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <AppShell>
      <AccountLayout title="Profile">
        <section className="group">
          <h2 className="group__title">Profile picture</h2>
          <PictureEditor current={current} choices={choices} />
          {choices.length === 1 ? (
            <p className="group__lead group__lead--after">
              Connect an account under Security to use its picture here.
            </p>
          ) : null}
        </section>

        {connections
          .filter((connection) => connection.connected && connection.hasProfile && connection.profile)
          .map((connection) => (
            <section className="group" key={connection.id}>
              <h2 className="group__title">From {connection.label}</h2>
              <ProviderProfile
                providerLabel={connection.label}
                profile={connection.profile as Record<string, unknown>}
              />
            </section>
          ))}

        <section className="group">
          <h2 className="group__title">Your details</h2>
          <div className="rows">
            <InlineField label="First name" field="firstName" value={account.firstName} />
            <InlineField label="Last name" field="lastName" value={account.lastName} />
            <div className="row">
              <span className="row__label">User ID</span>
              <span className="row__value">
                {account.userId ?? <span className="row__empty">Not set</span>}
                <span className="row__note">
                  Chosen when the account is created, and not changed afterwards.
                </span>
              </span>
              <span className="row__trailing" />
            </div>
            <div className="row">
              <span className="row__label">Created</span>
              <span className="row__value">{created}</span>
              <span className="row__trailing" />
            </div>
          </div>
        </section>

        <section className="group">
          <h2 className="group__title">Appearance</h2>
          <div className="rows">
            <div className="row">
              <span className="row__label">Theme</span>
              <span className="row__value">
                Follows your system until you choose
                <span className="row__note">Stored in this browser, not on your account.</span>
              </span>
              <span className="row__trailing">
                <ThemeToggle />
              </span>
            </div>
          </div>
        </section>
      </AccountLayout>
    </AppShell>
  );
}
