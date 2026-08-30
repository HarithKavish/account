import Link from 'next/link';
import { site } from '@/lib/config/site';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';

/**
 * Chrome for every page.
 *
 * There is deliberately no sign-in control here. The Account Platform has no
 * login — authentication lives at auth.harithkavish.com.
 */
export function AppShell({
  children,
  centered = false,
}: {
  children: React.ReactNode;
  /** Narrow, vertically centred column — used by signup. */
  centered?: boolean;
}) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="site-shell">
        <header className="site-header">
          <div className="site-header__inner">
            <Brand href="/" />
            <div className="site-header__actions">
              <ThemeToggle />
              <Link className="site-nav__link" href="/create_account">
                Create account
              </Link>
            </div>
          </div>
        </header>

        <main id="main" className={`site-main${centered ? ' site-main--centered' : ''}`}>
          {children}
        </main>

        <footer className="site-footer">
          <div className="site-footer__inner">
            <span>{site.domain}</span>
            {/* Reachable from every page, which is both good manners and what a
                provider's consent screen expects to be able to link to. */}
            <nav className="site-footer__links" aria-label="Legal">
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href={site.parentUrl}>HarithKavish</a>
            </nav>
          </div>
        </footer>
      </div>
    </>
  );
}
