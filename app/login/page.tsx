import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in',
};

/** Reads cookies and writes sessions, so it is never prerendered. */
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AppShell centered>
      {params.error ? (
        <p role="alert" className="form-error">
          That sign-in did not complete. Please try again.
        </p>
      ) : null}
      <LoginForm next={params.next} />
    </AppShell>
  );
}
