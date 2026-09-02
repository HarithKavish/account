import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { clearDisplayUser } from '@/lib/auth/ecosystem-cookie';
import { destroySession } from '@/lib/auth/session';
import { safeNext } from '@/lib/auth/flow';
import { ACCOUNT_HOST, AUTH_HOST, hostOf } from '@/lib/auth/hosts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Every hostname that can be holding a session for this browser.
 *
 * One sign-in can leave two. The front door establishes one, and a trip through
 * `/api/session/adopt` establishes a second on the account host — that is what
 * the handoff is *for*, because `__Host-hk_session` is host-only and neither
 * host can see the other's.
 *
 * Signing out therefore has to visit both. Destroying only the session on the
 * host that happened to serve the sign-out page leaves the other one live: the
 * person is told they are signed out, the display cookie is gone so every
 * surface agrees, and a session they no longer know about keeps working. That
 * is the worst shape a sign-out bug can take, and it is why these sessions
 * accumulate rather than being replaced.
 */
const SESSION_HOSTS: readonly string[] = [AUTH_HOST, ACCOUNT_HOST];

/**
 * Sign out.
 *
 * POST only: a GET would let any page sign someone out with an image tag.
 *
 * Both cookies go. Clearing only the session would leave every other surface
 * showing a face for a browser that no longer has one.
 *
 * A host can only destroy its own session, because a session is a cookie and a
 * cookie belongs to a host. So this destroys the one here and then hands the
 * browser to the next host that might hold one, which does the same and passes
 * it on. The chain is a fixed list walked forwards, and each host adds itself to
 * `done`, so it visits each host at most once and cannot loop.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const host = hostOf((await headers()).get('host')) || url.hostname;

  await destroySession();
  await clearDisplayUser(url.hostname);

  const form = await request.formData().catch(() => null);

  // Back where they were. Same allow-list as signing in — a sign-out link is
  // just as good a place to hide a redirect somewhere else.
  const next = safeNext(form ? String(form.get('next') ?? '') || null : null);

  /*
   * Hosts already visited, this one included. Read from the form rather than
   * kept server-side: it describes one browser's trip, not the account's state,
   * and a value that only ever shortens the chain cannot be abused by editing it
   * — the worst a tampered `done` can do is skip a host, which is precisely the
   * behaviour this whole route replaces.
   */
  const done = new Set(
    String(form?.get('done') ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
  done.add(host);

  const remaining = SESSION_HOSTS.find((candidate) => !done.has(candidate));

  if (remaining) {
    const onward = new URL('/signout', `https://${remaining}`);
    onward.searchParams.set('next', next);
    onward.searchParams.set('done', [...done].join(','));
    return NextResponse.redirect(onward, { status: 303 });
  }

  return NextResponse.redirect(new URL(next, url.origin), { status: 303 });
}
