import type { Metadata } from 'next';
import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import { AccountLayout } from '@/components/account-layout';
import { SignInUnavailable } from '@/components/sign-in-unavailable';
import { requireAccount } from '@/lib/auth/require';

export const metadata: Metadata = { title: 'Account' };

/** Server-rendered per request: it reads a session, so it can never be static. */
export const dynamic = 'force-dynamic';

export default async function AccountOverviewPage() {
  const account = await requireAccount();
  if (!account) {
    return (
      <AppShell>
        <AccountLayout title="Overview">
          <SignInUnavailable />
        </AccountLayout>
      </AppShell>
    );
  }

  const name = `${account.firstName} ${account.lastName}`.trim();

  return (
    <AppShell>
      <AccountLayout title="Overview">
        <section className="group">
          <h2 className="group__title">Signed in</h2>
          <div className="rows">
            <div className="row">
              <span className="row__label">Name</span>
              <span className="row__value">{name}</span>
              <span className="row__trailing" />
            </div>
            <div className="row">
              <span className="row__label">User ID</span>
              <span className="row__value">
                {account.userId ?? (
                  <span className="row__empty">Not set</span>
                )}
                {account.userId ? null : (
                  <span className="row__note">
                    This account signs in another way and has never needed one.
                  </span>
                )}
              </span>
              <span className="row__trailing" />
            </div>
          </div>
        </section>

        <section className="group">
          <h2 className="group__title">Manage</h2>
          <div className="rows">
            <div className="row">
              <span className="row__label">Profile</span>
              <span className="row__value">Your name and user ID</span>
              <span className="row__trailing">
                <Link className="row__action" href="/settings">
                  Open
                </Link>
              </span>
            </div>
            <div className="row">
              <span className="row__label">Security</span>
              <span className="row__value">Password and recovery codes</span>
              <span className="row__trailing">
                <Link className="row__action" href="/security">
                  Open
                </Link>
              </span>
            </div>
            <div className="row">
              <span className="row__label">Delete account</span>
              <span className="row__value">Permanently remove your account</span>
              <span className="row__trailing">
                <Link className="row__action row__action--danger" href="/delete">
                  Open
                </Link>
              </span>
            </div>
          </div>
        </section>
      </AccountLayout>
    </AppShell>
  );
}
