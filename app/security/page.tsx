import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { AccountLayout } from '@/components/account-layout';
import { SignInUnavailable } from '@/components/sign-in-unavailable';
import { countUnusedRecoveryCodes } from '@/lib/account/identity';
import { hasPassword } from '@/lib/account/manage';
import { requireAccount } from '@/lib/auth/require';
import { PasswordForm } from './password-form';
import { regenerateRecoveryCodes, signOutEverywhere } from './actions';

export const metadata: Metadata = { title: 'Security' };

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  const account = await requireAccount();
  if (!account) {
    return (
      <AppShell>
        <AccountLayout title="Security">
          <SignInUnavailable />
        </AccountLayout>
      </AppShell>
    );
  }

  const [withPassword, remainingCodes] = await Promise.all([
    hasPassword(account.id),
    countUnusedRecoveryCodes(account.id),
  ]);

  return (
    <AppShell>
      <AccountLayout title="Security">
        <section className="group">
          <h2 className="group__title">{withPassword ? 'Password' : 'Add a password'}</h2>
          {withPassword ? null : (
            <p className="group__lead">
              This account has no password yet. Setting one adds a second way in that does not
              depend on anyone else.
            </p>
          )}
          <PasswordForm hasPassword={withPassword} />
        </section>

        <section className="group">
          <h2 className="group__title">Recovery codes</h2>
          <div className="rows">
            <div className="row">
              <span className="row__label">Unused codes</span>
              <span className="row__value">
                {remainingCodes}
                <span className="row__note">
                  Each works once. Generating a new set replaces every code you have now.
                </span>
              </span>
              <span className="row__trailing">
                <form action={regenerateRecoveryCodes}>
                  <button type="submit" className="row__action">
                    Generate new codes
                  </button>
                </form>
              </span>
            </div>
          </div>
        </section>

        <section className="group">
          <h2 className="group__title">Sessions</h2>
          <div className="rows">
            <div className="row">
              <span className="row__label">Sign out everywhere</span>
              <span className="row__value">
                Ends every session on every device
                <span className="row__note">
                  Including this one — you will need to sign in again.
                </span>
              </span>
              <span className="row__trailing">
                <form action={signOutEverywhere}>
                  <button type="submit" className="row__action">
                    Sign out everywhere
                  </button>
                </form>
              </span>
            </div>
          </div>
        </section>
      </AccountLayout>
    </AppShell>
  );
}
