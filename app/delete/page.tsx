import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { AccountLayout } from '@/components/account-layout';
import { SignInUnavailable } from '@/components/sign-in-unavailable';
import { requireAccount } from '@/lib/auth/require';
import { DeleteForm } from './delete-form';

export const metadata: Metadata = { title: 'Delete account' };

export const dynamic = 'force-dynamic';

export default async function DeleteAccountPage() {
  const account = await requireAccount();
  if (!account) {
    return (
      <AppShell>
        <AccountLayout title="Delete account">
          <SignInUnavailable />
        </AccountLayout>
      </AppShell>
    );
  }

  const confirmWith = account.userId ?? `${account.firstName} ${account.lastName}`.trim();

  return (
    <AppShell>
      <AccountLayout title="Delete account">
        <section className="group">
          <h2 className="group__title">This cannot be undone</h2>
          <p className="group__lead">
            Deleting removes the account itself, every way of signing in to it, and every session
            it holds. Anything that identified you by this account across the ecosystem will stop
            recognising you.
          </p>
          <p className="group__lead">
            Your user ID becomes available for anyone to take afterwards.
          </p>
          <DeleteForm confirmWith={confirmWith} />
        </section>
      </AccountLayout>
    </AppShell>
  );
}
