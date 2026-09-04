import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { AccountLayout } from '@/components/account-layout';
import { SignInUnavailable } from '@/components/sign-in-unavailable';
import { countUnusedRecoveryCodes } from '@/lib/account/identity';
import { listConnections } from '@/lib/account/connections';
import { hasPassword } from '@/lib/account/manage';
import { AUTH_HOST, ACCOUNT_HOST } from '@/lib/auth/hosts';
import { hasGoogleEnv, hasGravatarEnv } from '@/lib/env';
import { requireAccount } from '@/lib/auth/require';
import { LockoutWarning } from '@/components/lockout-warning';
import { PasswordForm } from './password-form';
import { UserIdForm } from './user-id-form';
import { Passkeys } from './passkeys';
import { listPasskeys } from '@/lib/account/passkeys';
import { regenerateRecoveryCodes, signOutEverywhere } from './actions';

export const metadata: Metadata = { title: 'Security' };

export const dynamic = 'force-dynamic';

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
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

  const [withPassword, remainingCodes, connections, passkeys] = await Promise.all([
    hasPassword(account.id),
    countUnusedRecoveryCodes(account.id),
    listConnections(account.id),
    listPasskeys(account.id),
  ]);
  const available: Record<string, boolean> = {
    google: hasGoogleEnv(),
    gravatar: hasGravatarEnv(),
  };

  /*
   * Connecting begins at the front door, not here.
   *
   * The redirect URI registered with the provider names one host, and the flow's
   * secrets ride in a host-only cookie. A relative link would start the round
   * trip on whichever host is showing this page — which is how this arrived as
   * `redirect_uri_mismatch`.
   */
  const connectUrl = (provider: string) => {
    const start = new URL(`/api/auth/${provider}/start`, `https://${AUTH_HOST}`);
    if (provider === 'google') start.searchParams.set('mode', 'link');
    start.searchParams.set('next', `https://${ACCOUNT_HOST}/security`);
    return start.toString();
  };

  return (
    <AppShell>
      <AccountLayout title="Security">
        <LockoutWarning needsUserId={!account.userId} needsPassword={!withPassword} />

        {account.userId ? null : (
          <section className="group">
            <h2 className="group__title">Choose a user ID</h2>
            <p className="group__lead">
              This account was created through a connected service, so it never needed one. Choosing
              a user ID gives you something to sign in with here.
            </p>
            <UserIdForm />
          </section>
        )}

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
          <h2 className="group__title">Passkeys</h2>
          <Passkeys passkeys={passkeys} />
        </section>

        <section className="group">
          <h2 className="group__title">Connected accounts</h2>
          <p className="group__lead">
            Another way to sign in to this account. Connecting one does not hand it over — your
            HarithKavish account stays the identity, and this is only a way of reaching it.
          </p>

          {params.error === 'link_taken' ? (
            <p className="form-error" role="alert">
              That account is already connected to a different HarithKavish account. A provider
              account can only reach one of ours, so sign in to that one and delete it, or connect a
              different account here.
            </p>
          ) : null}

          {params.error === 'link_failed' ? (
            <p className="form-error" role="alert">
              That account could not be connected. Nothing changed — try again.
            </p>
          ) : null}

          {params.connected ? (
            <p className="form-note" role="status">
              Connected. You can use it as your profile picture under Profile.
            </p>
          ) : null}

          <div className="rows">
            {connections.map((connection) => (
              <div className="row" key={connection.id}>
                <span className="row__label">{connection.label}</span>
                <span className="row__value">
                  {connection.connected ? (
                    <>
                      Connected
                      {connection.email ? (
                        <span className="row__note">{connection.email}</span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className="row__empty">Not connected</span>
                      <span className="row__note">
                        {!available[connection.id]
                          ? `${connection.label} is not configured on this deployment.`
                          : connection.signsIn
                            ? `Sign in with ${connection.label} as well as your password.`
                            : `Use your ${connection.label} picture and profile here. It cannot sign you in.`}
                      </span>
                    </>
                  )}
                </span>
                <span className="row__trailing">
                  {connection.connected ? (
                    <span className="pill pill--neutral">Connected</span>
                  ) : available[connection.id] ? (
                    <a className="row__action" href={connectUrl(connection.id)}>
                      Connect
                    </a>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
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
