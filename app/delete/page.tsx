import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { AccountLayout } from '@/components/account-layout';
import { PendingAuth } from '@/components/pending-auth';
import { authPlatform } from '@/lib/config/site';

export const metadata: Metadata = { title: 'Delete account' };

/**
 * Account deletion.
 *
 * Deletion belongs to the Account Platform, and the data model supports it
 * (`account_status`, `deletion_requested_at`, `deleted_at`, and the
 * `account_deletion_*` events). What is deliberately absent is any endpoint
 * that would act on it: deleting an account from an unauthenticated browser
 * would be the single most dangerous thing this codebase could offer.
 *
 * The confirmation UI is laid out here so that connecting the Auth Platform is
 * the only remaining step.
 */
export default function DeleteAccountPage() {
  return (
    <AppShell>
      <AccountLayout title="Delete account">
        <PendingAuth action="Deleting your account" />

        <section className="group">
          <h2 className="group__title">What deleting does</h2>
          <div className="rows">
            <div className="row">
              <span className="row__label">Your account</span>
              <span className="row__value">
                Permanently removed, along with your name, user ID and password.
              </span>
              <span className="row__trailing" />
            </div>
            <div className="row">
              <span className="row__label">Your user ID</span>
              <span className="row__value">
                Released
                <span className="row__note">Someone else may be able to take it afterwards.</span>
              </span>
              <span className="row__trailing" />
            </div>
            <div className="row">
              <span className="row__label">Signing in</span>
              <span className="row__value">
                Stops working everywhere
                <span className="row__note">
                  {authPlatform.name} is told to invalidate your authentication, so HarithKavish
                  products will no longer recognise you.
                </span>
              </span>
              <span className="row__trailing" />
            </div>
            <div className="row">
              <span className="row__label">Product data</span>
              <span className="row__value">
                Kept by each product
                <span className="row__note">
                  Forge, Nexus and VR own their own data and handle their own deletion. This site
                  only removes the account itself.
                </span>
              </span>
              <span className="row__trailing" />
            </div>
          </div>
        </section>

        <section className="group">
          <h2 className="group__title">This cannot be undone</h2>
          <div className="rows">
            <div className="row">
              <span className="row__label">Delete my account</span>
              <span className="row__value row__empty">
                You will be asked to confirm your user ID and password first.
              </span>
              <span className="row__trailing">
                {/*
                  Disabled rather than hidden: the consequence should be visible
                  before it is reachable. It becomes live only once the Auth
                  Platform can prove who is asking.
                */}
                <button type="button" className="row__action row__action--danger" disabled>
                  Delete account
                </button>
              </span>
            </div>
          </div>
        </section>
      </AccountLayout>
    </AppShell>
  );
}
