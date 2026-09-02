import { json, preflight } from '@/lib/admin/cors';
import { resolveOwner } from '@/lib/admin/owner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Who am I, and may I read the dashboard?"
 *
 * The dashboard asks this first, before it asks for anything worth protecting,
 * so it can draw the right screen instead of a table that fails to load. It is
 * not the gate — the gate is on every route that returns data, and this one
 * returns none.
 *
 * Three answers, three status codes, because they call for three different
 * things from the visitor:
 *
 *   401  no session here — go to the front door
 *   403  signed in, not the owner — nothing to do but sign out
 *   200  the owner
 *
 * A 403 carries the viewer's own name and address. That is not a leak: it is
 * what they typed, told back to them, and without it "access denied" gives
 * someone with two accounts no way to know they are in the wrong one.
 */
export async function GET(request: Request) {
  const verdict = await resolveOwner();

  if (verdict.state === 'anonymous') {
    return json(request, { signedIn: false, owner: false }, 401);
  }

  return json(
    request,
    {
      signedIn: true,
      owner: verdict.state === 'owner',
      viewer: verdict.viewer,
    },
    verdict.state === 'owner' ? 200 : 403,
  );
}

export async function OPTIONS(request: Request) {
  return preflight(request);
}
