import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { takeRecoveryCodes } from '@/lib/auth/recovery-handoff';

export const metadata: Metadata = {
  title: 'Your recovery codes',
};

export const dynamic = 'force-dynamic';

/**
 * Shown once, immediately after an account is created through a provider.
 *
 * A federated-only account has exactly one way in and the ecosystem does not
 * control it — a disabled Google account is otherwise permanent lockout. These
 * are the way back, and this is the only time they exist in plaintext.
 */
export default async function RecoveryCodesPage() {
  const codes = await takeRecoveryCodes();

  // Nothing to show, and nothing to show again: the codes are read once.
  if (!codes || codes.length === 0) redirect('/account');

  return (
    <AppShell centered>
      <div className="stack" style={{ maxWidth: '30rem' }}>
        <div className="section-head">
          <h1 className="section-head__title">Save your recovery codes</h1>
          <p className="section-head__lead">
            You signed in with Google, so that is currently your only way into this
            account. If you ever lose access to it, one of these codes is how you
            get back in.
          </p>
        </div>

        <div className="card">
          <ul className="card__list" style={{ fontFamily: 'var(--font-mono)' }}>
            {codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </div>

        <p className="subtitle">
          Each code works once. This is the only time they are shown — they are
          stored hashed, so they cannot be shown again.
        </p>

        <a className="button button--primary" href="/account">
          I have saved them
        </a>
      </div>
    </AppShell>
  );
}
