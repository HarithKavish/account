'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/components/auth-provider';
import { ecosystem, site } from '@/lib/config/site';

/**
 * The entry point of the platform. Deliberately not a marketing page: it states
 * what a HarithKavish Account is and moves the visitor into the sign-in flow.
 */
export default function HomePage() {
  const { status, user } = useAuth();
  const authenticated = status === 'authenticated' && user;

  return (
    <AppShell>
      <section className="hero">
        <p className="hero__eyebrow">{site.domain}</p>
        <h1 className="hero__title">Your HarithKavish Account</h1>
        <p className="hero__lead">
          One account for signing in to HarithKavish products. It holds your identity and how you
          prove it — nothing else. Each product keeps its own data.
        </p>

        <div className="hero__actions">
          {authenticated ? (
            <>
              <Link className="button button--primary" href="/account">
                Continue as {user.firstName}
              </Link>
              <Link className="button button--secondary" href="/security">
                Review security
              </Link>
            </>
          ) : (
            <>
              <Link className="button button--primary" href="/login">
                Sign in
              </Link>
              <Link className="button button--secondary" href="/signup">
                Create an account
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="section">
        <div className="card-grid">
          <article className="card">
            <div className="card__topline">
              <h2 className="card__title">One identity</h2>
            </div>
            <p className="card__body">
              A single user ID and password, plus passkeys, used across HarithKavish products
              instead of a separate account for each one.
            </p>
          </article>

          <article className="card">
            <div className="card__topline">
              <h2 className="card__title">Kept minimal</h2>
            </div>
            <p className="card__body">
              Your name and a user ID. No phone number, no address, no date of birth, nothing
              collected because it might be useful later.
            </p>
          </article>

          <article className="card">
            <div className="card__topline">
              <h2 className="card__title">Clear boundaries</h2>
            </div>
            <p className="card__body">
              This platform is responsible for identity and authentication. Project data,
              workspaces and product settings stay with the product that owns them.
            </p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Where your account is headed</h2>
            <span className="pill pill--planned">Roadmap</span>
          </div>
          <p className="panel__body">
            Sign-in for these products has not been built yet. They are listed so the intent is
            clear, not because the connection exists today.
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
        </div>
      </section>
    </AppShell>
  );
}
