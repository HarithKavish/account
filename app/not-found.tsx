'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/components/auth-provider';

export default function NotFound() {
  const { status } = useAuth();
  const home = status === 'authenticated' ? '/account' : '/login';

  return (
    <AppShell centered>
      <div className="auth-card">
        <div className="auth-card__head">
          <h1 className="auth-card__title">Page not found</h1>
        </div>
        <div className="form__actions">
          <Link className="button button--primary button--full" href={home}>
            {status === 'authenticated' ? 'Back to your account' : 'Go to sign in'}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
