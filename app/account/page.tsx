import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { AccountLayout } from '@/components/account-layout';
import { PendingAuth } from '@/components/pending-auth';
import { authPlatform } from '@/lib/config/site';

export const metadata: Metadata = { title: 'Account' };

export default function AccountOverviewPage() {
  return (
    <AppShell>
      <AccountLayout title="Overview">
        <PendingAuth action="Viewing and changing your account" />

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
              <span className="row__value">Password and passkeys</span>
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

        <section className="group">
          <h2 className="group__title">Elsewhere</h2>
          <div className="rows">
            <div className="row">
              <span className="row__label">Signing in</span>
              <span className="row__value">
                {authPlatform.name}
                <span className="row__note">
                  {authPlatform.domain} — separate from this site, still being built.
                </span>
              </span>
              <span className="row__trailing" />
            </div>
            <div className="row">
              <span className="row__label">No account yet?</span>
              <span className="row__value">Create one in a minute</span>
              <span className="row__trailing">
                <Link className="row__action row__action--primary" href="/signup">
                  Create account
                </Link>
              </span>
            </div>
          </div>
        </section>
      </AccountLayout>
    </AppShell>
  );
}
