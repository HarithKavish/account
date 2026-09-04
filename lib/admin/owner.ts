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
 * Providers whose word is accepted as proof of an address *for this console*.
 *
 * Any issuer can assert any address; what makes an assertion mean something is
 * who made it. Gravatar is wired up here too and also asserts addresses, so
 * "any linked provider" would quietly widen the set of parties who can mint
 * proof of ownership of this console from one to however many are configured.
 * One is the right number, and it is named here rather than inferred.
 */
const TRUSTED_ISSUERS: readonly string[] = ['https://accounts.google.com'];

/**
 * The person asking, as they may be told about themselves.
 *
 * Returned on a refusal as well as an approval: someone who is signed in and
 * denied needs to know *which* account was refused and what the service knows
 * about it, or the only remedy they can find is to try the same one again.
 */
export interface Viewer {
  name: string;
  /** The address on the account row, which may be absent — see below. */
  email: string | null;
  /** Whether *that* address has been proved. */
  emailVerified: boolean;
  /** Addresses a trusted provider has asserted for this account. */
  providerEmails: string[];
  /** The issuers linked to this account, so a refusal can say how they got in. */
  identities: string[];
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
 * Authority comes from the `__Host-` session and the account behind it, and from
 * nothing else. In particular it never comes from `hk.user`: that cookie is
 * scoped to `.harithkavish.com`, so every subdomain — the GitHub Pages sites
 * included — can write it, and a dashboard that trusted it would be a dashboard
 * anyone with a subdomain could open.
 *
 * An address must be *proved*, never merely present. A typed address is text
 * somebody entered at sign-up (V27), so matching on one would let anyone reach
 * this console by typing the owner's address into a new account.
 *
 * There are two ways an address can be proved, and both are accepted:
 *
 *   1. `users.email` with `email_verified_at` set.
 *   2. A `user_identities` row from a trusted issuer whose `email_at_link` is
 *      the address.
 *
 * The second exists because the first is not always populated. `proveEmail` in
 * `lib/account/connections.ts` writes `users.email` when a provider is
 * *connected*, but `resolveFederatedIdentity` does not call it on the path where
 * the link already exists — so an account whose Google link predates that
 * function keeps a null address however many times its owner signs in with
 * Google. The proof is real; it is simply recorded in the other table.
 *
 * Reading `email_at_link` here is not the lookup the schema warns against. V27
 * forbids *resolving an account from* a provider-asserted address — "who owns
 * this address?" — because that hands an account to anyone who can get a
 * provider to assert it. This asks the opposite question of an account the
 * session has already identified: "does this account hold a link asserting the
 * owner's address?" Nothing is resolved, created, or matched across accounts.
 *
 * And the column only ever holds a proved address: every write of `email_at_link`
 * in this repository is guarded by the provider's own `email_verified`, so a
 * non-null value means somebody proved control of that address at that provider.
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

  const links = await db
    .select({
      issuer: schema.userIdentities.issuer,
      emailAtLink: schema.userIdentities.emailAtLink,
    })
    .from(schema.userIdentities)
    .where(eq(schema.userIdentities.userId, user.id));

  /* Every address this account has actually proved, however it proved it. */
  const proved = new Set<string>();

  if (user.email && user.emailVerifiedAt) {
    proved.add(user.email.trim().toLowerCase());
  }

  const providerEmails: string[] = [];
  for (const link of links) {
    if (!link.emailAtLink || !TRUSTED_ISSUERS.includes(link.issuer)) continue;
    const address = link.emailAtLink.trim().toLowerCase();
    proved.add(address);
    if (!providerEmails.includes(address)) providerEmails.push(address);
  }

  const viewer: Viewer = {
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    providerEmails,
    identities: links.map((link) => link.issuer),
  };

  const listed = OWNERS.some((owner) => proved.has(owner));

  if (listed && user.status === 'active') return { state: 'owner', viewer };
  return { state: 'denied', viewer };
}
