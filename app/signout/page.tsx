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
 *
 * `done` is carried through untouched. One sign-in can leave a session on both
 * hostnames, and only the host holding a session can destroy it, so the route
 * sends the browser on to the next host — arriving back at this page, which must
 * hand the list of hosts already visited to the form or the chain would start
 * over and never end.
 */
export default async function SignOutPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; done?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next ?? null);
  /* Opaque here: the route parses it, and it only ever shortens the chain. */
  const done = params.done ?? '';

  return (
    <main className="site-main">
      <form id="signout" method="post" action="/api/auth/signout">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="done" value={done} />
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
