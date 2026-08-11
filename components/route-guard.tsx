'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { normalizePath, readNextPath } from '@/lib/account/redirect';
import { useAuth } from './auth-provider';

function RouteLoading({ label }: { label: string }) {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/**
 * Wraps pages that require a signed-in user. Unauthenticated visitors are sent
 * to /login with a `next` parameter so they land back where they were headed.
 *
 * Protected content is never rendered while the session is still resolving.
 *
 * Phase 1 note: this is a client-side guard because the demo session lives in
 * browser storage. Once Phase 3 introduces real server sessions, protection
 * moves to the server (middleware / layout checks) and this component becomes a
 * progressive-enhancement layer rather than the boundary.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(normalizePath(pathname))}`);
    }
  }, [status, router, pathname]);

  if (status !== 'authenticated') {
    return <RouteLoading label="Checking your session…" />;
  }

  return <>{children}</>;
}

/**
 * Wraps /login and /signup. A signed-in visitor is redirected onward instead of
 * being shown a sign-in form they do not need.
 *
 * Unlike RequireAuth, the form renders while the session resolves: there is
 * nothing confidential on it, and holding it back would put a spinner in front
 * of every visitor for the sake of the rare already-signed-in case.
 */
export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(readNextPath());
    }
  }, [status, router]);

  if (status === 'authenticated') {
    return <RouteLoading label="Taking you to your account…" />;
  }

  return <>{children}</>;
}
