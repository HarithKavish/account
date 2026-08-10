'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { accountNav, footerNav, site } from '@/lib/config/site';
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
        <span aria-hidden="true">▲</span>
        <span>
          <strong>Preview build.</strong> Sign-in is a local demonstration, not real
          authentication — please don&rsquo;t enter a password you use elsewhere.
        </span>
      </p>
    </div>
  );
}

function HeaderNav() {
  const pathname = usePathname();
  const { status, user } = useAuth();

  if (status === 'authenticated' && user) {
    return (
      <div className="site-header__actions">
        <nav className="site-nav" aria-label="Account">
          {accountNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`site-nav__link${pathname === item.href ? ' is-active' : ''}`}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    );
  }

  return (
    <div className="site-header__actions">
      <nav className="site-nav" aria-label="Main">
        <Link
          href="/login"
          className={`site-nav__link${pathname === '/login' ? ' is-active' : ''}`}
          aria-current={pathname === '/login' ? 'page' : undefined}
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className={`site-nav__link${pathname === '/signup' ? ' is-active' : ''}`}
          aria-current={pathname === '/signup' ? 'page' : undefined}
        >
          Create account
        </Link>
      </nav>
      <ThemeToggle />
    </div>
  );
}

interface AppShellProps {
  children: React.ReactNode;
  /** Narrow, vertically centred main column — used by the auth pages. */
  centered?: boolean;
}

export function AppShell({ children, centered = false }: AppShellProps) {
  const { status, isDemo } = useAuth();
  const homeHref = status === 'authenticated' ? '/account' : '/';

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {isDemo && <DemoBanner />}

      <div className="site-shell">
        <header className="site-header">
          <div className="site-header__inner">
            <Brand href={homeHref} />
            <HeaderNav />
          </div>
        </header>

        <main id="main" className={`site-main${centered ? ' site-main--centered' : ''}`}>
          {children}
        </main>

        <footer className="site-footer">
          <div className="site-footer__inner">
            <p className="site-footer__copy">
              {site.name} · {site.domain}
            </p>
            <nav className="site-footer__nav" aria-label="Footer">
              {footerNav.map((item) => (
                <Link key={item.href} href={item.href} className="site-nav__link">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </footer>
      </div>
    </>
  );
}
