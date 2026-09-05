import type { ReactNode } from 'react';

import { AppShell } from './app-shell';

/**
 * A document meant to be read, and to be readable by a reviewer's tooling.
 *
 * Server-rendered with no client component in the tree: the text is in the HTML
 * that arrives. The apex site's legal page is a JS-mounted shell, which renders
 * nothing without scripts — no use as the URL a provider's consent screen points
 * at, and no use to anyone reading with scripts off.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <AppShell>
      <article className="legal">
        <h1 className="legal__title">{title}</h1>
        <p className="legal__meta">Last updated {updated}</p>
        {children}
      </article>
    </AppShell>
  );
}
