'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/components/auth-provider';
import { RequireAuth } from '@/components/route-guard';
import { initials } from '@/components/user-menu';
import { ecosystem } from '@/lib/config/site';
import type { AccountUser } from '@/lib/account/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function AccountOverview({ user }: { user: AccountUser }) {
  return (
    <>
      <section className="page-head">
        <p className="page-head__eyebrow">Account</p>
        <h1 className="page-head__title">Welcome, {user.firstName}</h1>
        <p className="page-head__lead">
          This is your HarithKavish Account. It holds who you are and how you sign in.
        </p>
      </section>

      <div className="stack">
        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Profile</h2>
            <Link className="button button--secondary" href="/settings">
              Edit profile
            </Link>
          </div>

          <div
            style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '0.35rem' }}
          >
            <span className="avatar avatar--lg" aria-hidden="true">
              {initials(user)}
            </span>
            <div>
              <p style={{ margin: 0, fontWeight: 650, fontSize: '1.1rem' }}>
                {user.firstName} {user.lastName}
              </p>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.92rem' }}>{user.userId}</p>
            </div>
          </div>

          <div className="data-list">
            <div className="data-list__row">
              <p className="data-list__label">First name</p>
              <p className="data-list__value">{user.firstName}</p>
              <span />
            </div>
            <div className="data-list__row">
              <p className="data-list__label">Last name</p>
              <p className="data-list__value">{user.lastName}</p>
              <span />
            </div>
            <div className="data-list__row">
              <p className="data-list__label">User ID</p>
              <p className="data-list__value data-list__value--mono">{user.userId}</p>
              <span />
            </div>
            <div className="data-list__row">
              <p className="data-list__label">Created</p>
              <p className="data-list__value">{formatDate(user.createdAt)}</p>
              <span />
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Account status</h2>
            <span className="pill pill--active">Active</span>
          </div>
          <p className="panel__body">
            Your account is in good standing. Review how you sign in on the Security page.
          </p>
          <div>
            <Link className="button button--secondary" href="/security">
              Go to Security
            </Link>
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Connected products</h2>
            <span className="pill pill--planned">Not yet available</span>
          </div>
          <p className="panel__body">
            Signing in to HarithKavish products with this account has not been built yet. Nothing
            is connected to your account today.
          </p>
          <div>
            {ecosystem.map((product) => (
              <div className="service-row" key={product.name}>
                <div className="service-row__text">
                  <p className="service-row__name">{product.name}</p>
                  <p className="service-row__desc">{product.description}</p>
                </div>
                <span className="pill pill--planned">Planned</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export default function AccountPage() {
  const { user } = useAuth();

  return (
    <AppShell>
      <RequireAuth>{user && <AccountOverview user={user} />}</RequireAuth>
    </AppShell>
  );
}
