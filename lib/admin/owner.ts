import 'server-only';

import { eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';

/**
 * Who is allowed to read the ecosystem dashboard.
 *
 * A constant in code, for the reason `lib/oauth/clients.ts` gives for its client
 * list: a registry that can be edited at runtime is a way to grant access
 * without review, and what this grants is a view of every account in the
 * ecosystem. Adding a reader is a deploy.
 *
 * Not an environment variable either. An env var is a runtime registry with
 * extra steps — a dashboard misconfiguration would silently widen who can read
 * the account table, and nothing in the repository would record that it had.
 */
const OWNERS: readonly string[] = ['harithkavish40@gmail.com'];

/**
 * The person asking, as they may be told about themselves.
 *
 * Returned on a refusal as well as an approval: someone who is signed in and
 * denied needs to know *which* account was refused, or the only remedy they can
 * find is to try the same one again.
 */
export interface Viewer {
  name: string;
  email: string | null;
  emailVerified: boolean;
}

export type OwnerVerdict =
  /** No session on this host. Sign in first. */
  | { state: 'anonymous' }
  /** Signed in, and not the owner. */
  | { state: 'denied'; viewer: Viewer }
  | { state: 'owner'; viewer: Viewer };

/**
 * Resolve the current request to one of three answers.
 *
 * Authority comes from the `__Host-` session and the account row behind it, and
 * from nothing else. In particular it never comes from `hk.user`: that cookie is
 * scoped to `.harithkavish.com`, so every subdomain — the GitHub Pages sites
 * included — can write it, and a dashboard that trusted it would be a dashboard
 * anyone with a subdomain could open.
 *
 * The address must be *proved*, not merely present. An unverified email is text
 * somebody typed at sign-up, so matching on one would let anyone reach this by
 * typing the owner's address into a new account.
 */
export async function resolveOwner(): Promise<OwnerVerdict> {
  const session = await getSessionUser();
  if (!session) return { state: 'anonymous' };

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);

  const user = rows[0];
  // A session is not permission to exist: it does not outlive its account.
  if (!user || user.status === 'deleted') return { state: 'anonymous' };

  const viewer: Viewer = {
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
  };

  const proved = user.emailVerifiedAt !== null;
  const listed = user.email !== null && OWNERS.includes(user.email.trim().toLowerCase());

  if (proved && listed && user.status === 'active') return { state: 'owner', viewer };
  return { state: 'denied', viewer };
}
