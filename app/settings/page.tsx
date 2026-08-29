import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { AccountLayout } from '@/components/account-layout';
import { SignInUnavailable } from '@/components/sign-in-unavailable';
import { ThemeToggle } from '@/components/theme-toggle';
import { requireAccount } from '@/lib/auth/require';
import { ProfileForm } from './profile-form';

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

  const created = new Date(account.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <AppShell>
      <AccountLayout title="Profile">
        <section className="group">
          <h2 className="group__title">Your name</h2>
          <ProfileForm firstName={account.firstName} lastName={account.lastName} />
        </section>

        <section className="group">
          <h2 className="group__title">Your details</h2>
          <div className="rows">
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
