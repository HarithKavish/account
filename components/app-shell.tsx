'use client';

import Link from 'next/link';
import { site } from '@/lib/config/site';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { useAuth } from './auth-provider';

/**
 * Honest, permanent notice while the Phase 1 demo backend is installed. It
 * disappears on its own once a backend reports `kind === 'server'`.
 */
function DemoBanner() {
  return (
    <div className="demo-banner">
      <p className="demo-banner__inner">
        <strong>Preview.</strong> Sign-in is a local demonstration, not real authentication — don&rsquo;t
        use a password you rely on elsewhere.
      </p>
    </div>
  );
}

interface AppShellProps {
  children: React.ReactNode;
  /** Narrow, vertically centred column — used by the sign-in pages. */
  centered?: boolean;
}

export function AppShell({ children, centered = false }: AppShellProps) {
  const { status, user, isDemo } = useAuth();
  const authenticated = status === 'authenticated' && user;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {isDemo && <DemoBanner />}

      <div className="site-shell">
        <header className="site-header">
          <div className="site-header__inner">
            <Brand href={authenticated ? '/account' : '/login'} />
            <div className="site-header__actions">
              <ThemeToggle />
              {authenticated ? (
                <UserMenu user={user} />
              ) : (
                <Link className="site-nav__link" href="/login">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>

        <main id="main" className={`site-main${centered ? ' site-main--centered' : ''}`}>
          {children}
        </main>

        <footer className="site-footer">
          <div className="site-footer__inner">
            <span>{site.domain}</span>
            <a href={site.parentUrl}>HarithKavish</a>
          </div>
        </footer>
      </div>
    </>
  );
}
