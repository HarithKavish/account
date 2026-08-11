import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { AccountLayout } from '@/components/account-layout';
import { PendingAuth, PendingPill } from '@/components/pending-auth';
import { ThemeToggle } from '@/components/theme-toggle';

export const metadata: Metadata = { title: 'Profile' };

/**
 * Profile. The fields listed are exactly what the `users` table stores — no
 * placeholder values are shown, because there is no signed-in account to read.
 */
export default function ProfilePage() {
  return (
    <AppShell>
      <AccountLayout title="Profile">
        <PendingAuth action="Viewing and editing your profile" />

        <section className="group">
          <h2 className="group__title">Your details</h2>
          <div className="rows">
            <div className="row">
              <span className="row__label">First name</span>
              <span className="row__value row__empty">Available once signed in</span>
              <span className="row__trailing">
                <PendingPill />
              </span>
            </div>
            <div className="row">
              <span className="row__label">Last name</span>
              <span className="row__value row__empty">Available once signed in</span>
              <span className="row__trailing">
                <PendingPill />
              </span>
            </div>
            <div className="row">
              <span className="row__label">User ID</span>
              <span className="row__value row__empty">
                Available once signed in
                <span className="row__note">Chosen when the account is created.</span>
              </span>
              <span className="row__trailing" />
            </div>
            <div className="row">
              <span className="row__label">Created</span>
              <span className="row__value row__empty">Available once signed in</span>
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
