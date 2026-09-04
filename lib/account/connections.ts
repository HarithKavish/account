import 'server-only';

import { and, eq, ne } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db/client';
import { GOOGLE_ISSUER } from '@/lib/auth/google';
import { GRAVATAR_ISSUER } from '@/lib/auth/gravatar';
import type { Result, VerifiedProviderIdentity } from './types';

/**
 * Ways of reaching an account, and the picture one of them lends it.
 *
 * A HarithKavish account is the identity; a provider is one way of proving it
 * (V24). So these are *connections* to an account that already exists, never
 * accounts in their own right, and the account is perfectly usable with none.
 */

export type ProviderId = 'google' | 'gravatar';

export interface Provider {
  id: ProviderId;
  label: string;
  issuer: string;
  /**
   * Whether this provider can also prove an identity.
   *
   * Google can: it signs people in and may create an account. Gravatar cannot —
   * it is connected by someone already signed in and only lends the account a
   * picture and a profile, so it can never become another way to end up with two
   * accounts.
   */
  signsIn: boolean;
  /** Whether it offers a profile worth keeping a snapshot of. */
  hasProfile: boolean;
}

/** Every provider a person may connect, whether or not they have. */
export const PROVIDERS: readonly Provider[] = [
  { id: 'google', label: 'Google', issuer: GOOGLE_ISSUER, signsIn: true, hasProfile: false },
  { id: 'gravatar', label: 'Gravatar', issuer: GRAVATAR_ISSUER, signsIn: false, hasProfile: true },
];

export interface Connection extends Provider {
  connected: boolean;
  /** What the provider asserted, for recognising which of their accounts it is. */
  email: string | null;
  picture: string | null;
  linkedAt: string | null;
  /** The snapshot taken when it was connected, for providers that offer one. */
  profile: Record<string, unknown> | null;
}

/** Which providers this account is connected to, and which it is not. */
export async function listConnections(userId: string): Promise<Connection[]> {
  const db = getDb();
  const links = await db
    .select()
    .from(schema.userIdentities)
    .where(eq(schema.userIdentities.userId, userId));

  return PROVIDERS.map((provider) => {
    const link = links.find((l) => l.issuer === provider.issuer);
    return {
      ...provider,
      connected: Boolean(link),
      email: link?.emailAtLink ?? null,
      picture: link?.pictureUrl ?? null,
      linkedAt: link?.linkedAt.toISOString() ?? null,
      profile: link?.profile ?? null,
    };
  });
}

/**
 * Record that a provider proved this account's address.
 *
 * The other half of verified-only matching. An address typed at sign-up is not
 * proof of anything; it becomes proof when a provider asserts it for an account
 * whose owner is already signed in — which is exactly what connecting one is.
 *
 * An address the account does not claim is left alone: what the provider
 * asserted is kept beside the link, and the account's own address is the
 * account's to state. A promotion that collides with another account's proved
 * address simply does not happen — the link still succeeds, because a way in is
 * not contingent on who owns an address.
 */
async function proveEmail(userId: string, identity: VerifiedProviderIdentity): Promise<void> {
  if (!identity.emailVerified || !identity.email) return;

  const address = identity.email.trim().toLowerCase();
  const db = getDb();

  try {
    const rows = await db
      .select({ email: schema.users.email, verifiedAt: schema.users.emailVerifiedAt })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    const current = rows[0];
    if (!current) return;
    if (current.verifiedAt) return;
    if (current.email && current.email !== address) return;

    await db
      .update(schema.users)
      .set({ email: address, emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  } catch {
    // Another account already proved this address. The connection stands.
  }
}

export type LinkOutcome = 'linked' | 'already_linked_here';

/**
 * Connect a verified provider identity to an account that already exists.
 *
 * Distinct from `resolveFederatedIdentity`, which signs someone in and may
 * create an account. This one never creates anything: the account is the one
 * already holding the session, and the only question is whether this provider
 * identity may join it.
 *
 * It may not if it already belongs to someone else. Silently moving the link
 * would take a way in away from that other account, and letting both hold it
 * would make one provider subject reach two accounts — which the unique index on
 * (issuer, subject) exists to prevent, and which is how a takeover starts.
 */
export async function linkIdentity(
  userId: string,
  identity: VerifiedProviderIdentity,
): Promise<Result<LinkOutcome>> {
  const db = getDb();

  try {
    const claimedElsewhere = await db
      .select({ id: schema.userIdentities.id })
      .from(schema.userIdentities)
      .where(
        and(
          eq(schema.userIdentities.issuer, identity.issuer),
          eq(schema.userIdentities.subject, identity.subject),
          ne(schema.userIdentities.userId, userId),
        ),
      )
      .limit(1);

    if (claimedElsewhere.length > 0) {
      return {
        ok: false,
        error: {
          code: 'identity_taken',
          message: 'That account is already connected to a different HarithKavish account.',
        },
      };
    }

    const mine = await db
      .select()
      .from(schema.userIdentities)
      .where(
        and(
          eq(schema.userIdentities.userId, userId),
          eq(schema.userIdentities.issuer, identity.issuer),
        ),
      )
      .limit(1);

    if (mine.length > 0) {
      // Re-connecting the same provider: refresh what it asserted rather than
      // adding a second row for the same way in.
      await db
        .update(schema.userIdentities)
        .set({
          subject: identity.subject,
          emailAtLink: identity.emailVerified ? identity.email : null,
          pictureUrl: identity.picture,
          lastAuthenticatedAt: new Date(),
        })
        .where(eq(schema.userIdentities.id, mine[0].id));

      await proveEmail(userId, identity);
      return { ok: true, data: 'already_linked_here' };
    }

    await db.insert(schema.userIdentities).values({
      userId,
      issuer: identity.issuer,
      subject: identity.subject,
      emailAtLink: identity.emailVerified ? identity.email : null,
      pictureUrl: identity.picture,
      lastAuthenticatedAt: new Date(),
    });

    await db.insert(schema.accountEvents).values({
      userId,
      type: 'identity_linked',
      metadata: { issuer: identity.issuer },
    });

    await proveEmail(userId, identity);

    return { ok: true, data: 'linked' };
  } catch {
    return {
      ok: false,
      error: { code: 'database_unavailable', message: 'Could not reach the account store.' },
    };
  }
}

/**
 * Connect a provider that lends a profile rather than proving an identity.
 *
 * Same rule as `linkIdentity` on the subject already belonging to someone else,
 * and the same refusal — but this one also carries the snapshot, and it is never
 * reachable from a sign-in path because the provider cannot sign anyone in.
 */
export async function linkProfileProvider(
  userId: string,
  input: {
    issuer: string;
    subject: string;
    pictureUrl: string | null;
    profile: Record<string, unknown>;
  },
): Promise<Result<LinkOutcome>> {
  const db = getDb();

  try {
    const claimedElsewhere = await db
      .select({ id: schema.userIdentities.id })
      .from(schema.userIdentities)
      .where(
        and(
          eq(schema.userIdentities.issuer, input.issuer),
          eq(schema.userIdentities.subject, input.subject),
          ne(schema.userIdentities.userId, userId),
        ),
      )
      .limit(1);

    if (claimedElsewhere.length > 0) {
      return {
        ok: false,
        error: {
          code: 'identity_taken',
          message: 'That account is already connected to a different HarithKavish account.',
        },
      };
    }

    const mine = await db
      .select()
      .from(schema.userIdentities)
      .where(
        and(
          eq(schema.userIdentities.userId, userId),
          eq(schema.userIdentities.issuer, input.issuer),
        ),
      )
      .limit(1);

    if (mine.length > 0) {
      // Reconnecting is how a stale snapshot is refreshed, since the token that
      // could have done it quietly was thrown away.
      await db
        .update(schema.userIdentities)
        .set({
          subject: input.subject,
          pictureUrl: input.pictureUrl,
          profile: input.profile,
          lastAuthenticatedAt: new Date(),
        })
        .where(eq(schema.userIdentities.id, mine[0].id));

      return { ok: true, data: 'already_linked_here' };
    }

    await db.insert(schema.userIdentities).values({
      userId,
      issuer: input.issuer,
      subject: input.subject,
      pictureUrl: input.pictureUrl,
      profile: input.profile,
      lastAuthenticatedAt: new Date(),
    });

    await db.insert(schema.accountEvents).values({
      userId,
      type: 'identity_linked',
      metadata: { issuer: input.issuer },
    });

    return { ok: true, data: 'linked' };
  } catch {
    return {
      ok: false,
      error: { code: 'database_unavailable', message: 'Could not reach the account store.' },
    };
  }
}

export type PictureSource = 'none' | ProviderId;

export function isPictureSource(value: string): value is PictureSource {
  return value === 'none' || PROVIDERS.some((provider) => provider.id === value);
}

/**
 * Choose which picture represents the account.
 *
 * Only a connected provider may be chosen. Anything else is refused rather than
 * stored and quietly ignored later, because a stored preference that cannot be
 * honoured is a bug waiting for someone to read the column and believe it.
 */
export async function setPictureSource(
  userId: string,
  source: PictureSource,
): Promise<Result<PictureSource>> {
  if (source !== 'none') {
    const connections = await listConnections(userId);
    const provider = connections.find((c) => c.id === source);
    if (!provider?.connected) {
      return {
        ok: false,
        error: { code: 'validation_failed', message: 'That account is not connected.' },
      };
    }
  }

  const db = getDb();
  await db
    .update(schema.users)
    .set({ pictureSource: source, updatedAt: new Date() })
    .where(eq(schema.users.id, userId));

  await db.insert(schema.accountEvents).values({
    userId,
    type: 'profile_updated',
    metadata: { picture: source },
  });

  return { ok: true, data: source };
}

/**
 * The picture to show, or null for the placeholder.
 *
 * Null is a perfectly good answer: the placeholder is the default, not a failure
 * state. It is also what a chosen-but-since-disconnected provider resolves to,
 * so the account never renders a broken image.
 */
export async function resolvePicture(userId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ source: schema.users.pictureSource })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  const source = rows[0]?.source ?? 'none';
  if (source === 'none' || !isPictureSource(source)) return null;

  const connections = await listConnections(userId);
  return connections.find((c) => c.id === source && c.connected)?.picture ?? null;
}
