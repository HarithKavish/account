import type { Metadata } from 'next';
import { AppShell } from '@/components/app-shell';
import { SignupForm } from './signup-form';

export const metadata: Metadata = {
  title: 'Create your account',
};

/**
 * Account creation writes to the real database via a Server Action, so this
 * route must never be statically prerendered.
 */
export const dynamic = 'force-dynamic';

export default function SignupPage() {
  return (
    <AppShell centered>
      <SignupForm />
    </AppShell>
  );
}
