import { readAccounts } from '@/lib/admin/accounts';
import { json, preflight } from '@/lib/admin/cors';
import { resolveOwner } from '@/lib/admin/owner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Every account holder in the ecosystem.
 *
 * The gate is here rather than in middleware, and it is the same gate the
 * session route reports: the check runs on the request that returns the data,
 * so a client that skipped the first call gains nothing by it.
 *
 * The refusal is deliberately shaped like the session route's, so the dashboard
 * can react to a session that ended mid-visit exactly as it reacts to one that
 * was never there.
 */
export async function GET(request: Request) {
  const verdict = await resolveOwner();

  if (verdict.state === 'anonymous') {
    return json(request, { error: 'not_signed_in' }, 401);
  }
  if (verdict.state === 'denied') {
    return json(request, { error: 'not_authorised', viewer: verdict.viewer }, 403);
  }

  try {
    return json(request, await readAccounts(), 200);
  } catch {
    // The reason is not repeated to the client. It would say something about
    // the database, and a dashboard that cannot reach its store needs to say
    // only that.
    return json(request, { error: 'store_unavailable' }, 503);
  }
}

export async function OPTIONS(request: Request) {
  return preflight(request);
}
