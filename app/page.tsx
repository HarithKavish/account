import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { ECOSYSTEM_USER_COOKIE } from '@/lib/auth/ecosystem-cookie';
import { getSessionUser } from '@/lib/auth/session';
import { authPlatform } from '@/lib/config/site';

/** Reads cookies to decide where to send someone, so it cannot be static. */
export const dynamic = 'force-dynamic';

/**
 * The entry point. Directs a visitor without an account to create one, and a
 * visitor who has one to management. It does not offer to sign anyone in.
 *
 * Someone arriving from another surface — the launcher tile on nexus, say — is
 * already signed in and wants their account, not an invitation to create one.
 * They are sent to `/account`, which does the real check.
 *
 * The display cookie is a hint and nothing more: it decides which page to show,
 * never what anyone may see. `/account` requires a session of its own and will
 * send them through the front door if there is none, so a forged hint buys
 * exactly one redirect to a page that refuses.
 */
export default async function HomePage() {
  const jar = await cookies();
  const appearsSignedIn = Boolean(await getSessionUser()) || jar.has(ECOSYSTEM_USER_COOKIE);
  if (appearsSignedIn) redirect('/account');

  return (
    <AppShell>
      <section className="hero">
        <h1 className="hero__title">Your HarithKavish Account</h1>
        <p className="hero__lead">
          One account used across HarithKavish platforms and services. This is where you create it
          and manage it.
        </p>

        <div className="hero__actions">
          <Link className="button button--primary" href="/create_account">
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
