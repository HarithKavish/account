import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { authPlatform } from '@/lib/config/site';

/**
 * The entry point. Directs a visitor without an account to create one, and a
 * visitor who has one to management. It does not offer to sign anyone in.
 */
export default function HomePage() {
  return (
    <AppShell>
      <section className="hero">
        <h1 className="hero__title">Your HarithKavish Account</h1>
        <p className="hero__lead">
          One account used across HarithKavish platforms and services. This is where you create it
          and manage it.
        </p>

        <div className="hero__actions">
          <Link className="button button--primary" href="/signup">
            Create your account
          </Link>
          <Link className="button button--secondary" href="/account">
            Manage your account
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="rows">
          <div className="row">
            <span className="row__label">This site</span>
            <span className="row__value">
              Creating your account, your profile, your password, and deleting your account.
            </span>
            <span className="row__trailing" />
          </div>
          <div className="row">
            <span className="row__label">Signing in</span>
            <span className="row__value">
              Handled by {authPlatform.name} at <strong>{authPlatform.domain}</strong>, a separate
              service. HarithKavish products send you there to sign in.
              <span className="row__note">Still being built.</span>
            </span>
            <span className="row__trailing" />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
