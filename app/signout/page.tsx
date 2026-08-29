import type { Metadata } from 'next';

import { safeNext } from '@/lib/auth/flow';

export const metadata: Metadata = { title: 'Signing out' };
export const dynamic = 'force-dynamic';

/**
 * Signing out, from anywhere in the ecosystem.
 *
 * Every surface links here rather than posting to the sign-out route directly.
 * A cross-site POST would not carry the session cookie — it is SameSite=Lax —
 * so the request would arrive unauthenticated and the session would survive,
 * which is exactly the bug this page exists to close.
 *
 * A top-level navigation does carry it. This page then posts to the route from
 * the same origin, which cannot be triggered by an image or a script tag on
 * someone else's site.
 */
export default async function SignOutPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next ?? null);

  return (
    <main className="site-main">
      <form id="signout" method="post" action="/api/auth/signout">
        <input type="hidden" name="next" value={next} />
        <noscript>
          <button type="submit" className="button button--primary">
            Sign out
          </button>
        </noscript>
      </form>
      <p className="subtitle">Signing you out…</p>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.getElementById('signout').submit();`,
        }}
      />
    </main>
  );
}
