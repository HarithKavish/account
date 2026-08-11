import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { AccountLayout } from '@/components/account-layout';
import { PendingAuth, PendingPill } from '@/components/pending-auth';
import { authPlatform } from '@/lib/config/site';

export const metadata: Metadata = { title: 'Security' };

/**
 * Security.
 *
 * The password is stored by this platform (Argon2id) because credentials are
 * account lifecycle data. Changing it still requires proving who you are, which
 * is the Auth Platform's job — hence the gate.
 *
 * Passkeys are described but not built: registering credentials here before the
 * Account/Auth contract exists would either duplicate WebAuthn logic that
 * belongs to Auth, or bake in a guess about which side owns it.
 */
export default function SecurityPage() {
  return (
    <AppShell>
      <AccountLayout title="Security">
        <PendingAuth action="Changing your password" />

        <section className="group">
          <h2 className="group__title">Password</h2>
          <div className="rows">
            <div className="row">
              <span className="row__label">Password</span>
              <span className="row__value">
                Set when you created your account
                <span className="row__note">
                  Stored only as an Argon2id hash. It is never shown back to you and never leaves
                  the server.
                </span>
              </span>
              <span className="row__trailing" />
            </div>
            <div className="row">
              <span className="row__label">Change password</span>
              <span className="row__value row__empty">
                Requires confirming your current password
              </span>
              <span className="row__trailing">
                <PendingPill />
              </span>
            </div>
          </div>
        </section>

        <section className="group">
          <h2 className="group__title">Passkeys</h2>
          <div className="rows">
            <div className="row">
              <span className="row__label">Passkeys</span>
              <span className="row__value row__empty">
                Not available yet
                <span className="row__note">
                  Passkeys let you sign in with your device instead of a password. Because signing
                  in belongs to {authPlatform.name}, how passkeys are registered and verified is
                  being settled between the two services before either builds it.
                </span>
              </span>
              <span className="row__trailing">
                <PendingPill />
              </span>
            </div>
          </div>
        </section>

        <section className="group">
          <h2 className="group__title">Sessions</h2>
          <div className="rows">
            <div className="row">
              <span className="row__label">Active sessions</span>
              <span className="row__value row__empty">
                Managed elsewhere
                <span className="row__note">
                  This site has no login and creates no sessions. Where you are signed in is
                  {' '}{authPlatform.domain}&rsquo;s to show.
                </span>
              </span>
              <span className="row__trailing" />
            </div>
          </div>
        </section>
      </AccountLayout>
    </AppShell>
  );
}
