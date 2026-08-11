import Link from 'next/link';
import { AppShell } from '@/components/app-shell';

export default function NotFound() {
  return (
    <AppShell centered>
      <div className="auth-card">
        <div className="auth-card__head">
          <h1 className="auth-card__title">Page not found</h1>
        </div>
        <div className="form__actions">
          <Link className="button button--primary button--full" href="/">
            Go to the account site
          </Link>
          <Link className="button button--secondary button--full" href="/signup">
            Create an account
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
