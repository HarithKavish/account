import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * HarithKavish Account — database schema.
 *
 * SCOPE: this database belongs to the Account Platform, which owns the account
 * lifecycle — creation, profile, credentials as stored data, and deletion.
 *
 * Under contract §0.5 the account half and the authentication half are one
 * deployable, so both their tables live here. They are still two owners:
 *
 *   - The ACCOUNT half owns `users`, `user_identities`, `recovery_codes` and
 *     `account_events` — the person, and how they can prove they are them.
 *   - The AUTHENTICATION half owns `sessions` — the fact that someone proved it,
 *     just now, on this browser.
 *
 * The authentication half reaches account data only through
 * `lib/account/service.ts`. §15 names the first query across that line as the
 * point where separating the halves again stops being a refactor, so the line is
 * kept in code even though nothing enforces it.
 *
 * There is no `passkeys` table yet. The contract designs one (§6) but nothing
 * registers a passkey, and V11's RP ID is only fixed from the first that does.
 */

/**
 * Account lifecycle state.
 *
 * `deletion_requested` exists so a deletion can be confirmed and recorded
 * before the record is destroyed, which is what lets the Auth Platform be told
 * to invalidate its own state before the account disappears.
 */
export const accountStatus = pgEnum('account_status', [
  'active',
  'deletion_requested',
  'deleted',
]);

export const users = pgTable(
  'users',
  {
    /** Internal, stable, never shown as a login identity. */
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * The public login identifier the user chooses and types, lowercased so
     * uniqueness is case-insensitive.
     *
     * NULL means this person has not chosen one — they arrived through a
     * provider and have never needed it (§6.4). Postgres allows many NULLs under
     * a UNIQUE index, so the constraint below is unaffected. It is never
     * generated on their behalf: it is the name they log in with, and inventing
     * one takes the choice they may want later.
     */
    userId: text('user_id'),

    /**
     * Argon2id encoded hash. Never returned to a client, never logged.
     *
     * NULL means this account has no password (§6.4). Deliberately NULL rather
     * than a sentinel hash: a credential-shaped value in a credential column is
     * one mistake away from being verified against.
     */
    passwordHash: text('password_hash'),

    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),

    status: accountStatus('status').notNull().default('active'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    /** Set when the user asks for deletion; cleared if they cancel. */
    deletionRequestedAt: timestamp('deletion_requested_at', { withTimezone: true }),
    /** Set when the account is actually destroyed or tombstoned. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    // Database-level uniqueness. The application also checks first, to return a
    // friendly message, but this constraint is what actually guarantees it
    // under concurrent signups.
    uniqueIndex('users_user_id_unique').on(table.userId),
    index('users_status_idx').on(table.status),
  ],
);

/**
 * Lifecycle audit trail. Deliberately minimal.
 *
 * NEVER store credential material here — no passwords, no hashes, no tokens.
 * `metadata` is for non-sensitive descriptors only (e.g. which fields changed).
 */
export const accountEventType = pgEnum('account_event_type', [
  'account_created',
  'profile_updated',
  'password_changed',
  'account_deletion_requested',
  'account_deletion_cancelled',
  'account_deleted',
  /* Federation (§6.3). Unlinking is a credentials change and must invalidate
     sessions; linking is not — adding a way in invalidates nothing, and treating
     it as a change would sign someone out for improving their own security. */
  'identity_linked',
  'identity_unlinked',
  /* Recovery (§6.1). */
  'recovery_codes_generated',
  'recovery_code_used',
]);

export const accountEvents = pgTable(
  'account_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Nullable and ON DELETE SET NULL: a hard-deleted account must not drag its
     * audit trail away with it, but the trail must not resurrect the identity
     * either — hence no denormalised copy of the user's name or user_id here.
     */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

    type: accountEventType('type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),

    /** Non-sensitive context only. */
    metadata: jsonb('metadata').$type<Record<string, string | number | boolean>>(),
  },
  (table) => [index('account_events_user_id_idx').on(table.userId)],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type AccountEventRow = typeof accountEvents.$inferSelect;

/* -------------------------------------------------------------------------- */
/* Federated identity — contract §6.3                                          */
/* -------------------------------------------------------------------------- */

/**
 * A way of proving an account, not an account.
 *
 * A HarithKavish account is the identity (V24). Google is one way to reach it,
 * and a person may hold several links. Removing a link must not remove them.
 */
export const userIdentities = pgTable(
  'user_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** e.g. `https://accounts.google.com`. Stored verbatim. */
    issuer: text('issuer').notNull(),

    /** The provider's `sub`. Opaque — never parsed, and never a `sub` of ours. */
    subject: text('subject').notNull(),

    /**
     * What the provider asserted when the link was made. Display and audit only.
     * Deliberately NOT indexed: it is not a lookup key (V27), and an index would
     * invite it to become one — which is how a verified address becomes an
     * account-takeover path.
     */
    emailAtLink: text('email_at_link'),

    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    lastAuthenticatedAt: timestamp('last_authenticated_at', { withTimezone: true }),
  },
  (table) => [
    // What makes resolve idempotent, and what stops one provider identity
    // reaching two accounts.
    uniqueIndex('user_identities_issuer_subject_unique').on(table.issuer, table.subject),
    index('user_identities_user_id_idx').on(table.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Recovery — contract §6.1                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The way back in when the only way in is gone.
 *
 * A federated-only account has exactly one way in and the ecosystem does not
 * control it: a disabled Google account would otherwise be permanent lockout.
 * This is why the contract requires recovery to land before federation.
 *
 * Codes are stored hashed, for the same reason passwords are.
 */
export const recoveryCodes = pgTable(
  'recovery_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Argon2id hash of the code. The plaintext is shown once and never stored. */
    codeHash: text('code_hash').notNull(),

    /** Single use. Set the moment it is accepted. */
    usedAt: timestamp('used_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('recovery_codes_user_id_idx').on(table.userId)],
);

/* -------------------------------------------------------------------------- */
/* Sessions — owned by the authentication half                                 */
/* -------------------------------------------------------------------------- */

/**
 * Someone proved who they are, on this browser, at this time.
 *
 * Opaque and server-side rather than a signed token: revocation is then a
 * DELETE, not a key rotation and a denylist. First-party SSO does not need a
 * self-describing token, and a token nobody can withdraw is worse than a lookup.
 *
 * The cookie carries a token; only its hash is stored, so a database leak does
 * not hand over live sessions.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** SHA-256 of the cookie token. */
    tokenHash: text('token_hash').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    /** Non-sensitive context, so a person can recognise their own sessions. */
    userAgent: text('user_agent'),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

/**
 * A one-time ticket that moves a signed-in person between our own hostnames.
 *
 * The session cookie is `__Host-` prefixed, so it is host-only by definition and
 * `auth.harithkavish.com` cannot hand it to `account.harithkavish.com`. Widening
 * it to `.harithkavish.com` would fix that in one line and send the session
 * token to every subdomain — including the GitHub Pages sites — so it is not an
 * option.
 *
 * Instead the auth host mints one of these, the destination host redeems it once
 * and establishes its own session. The ticket is worthless without being spent,
 * is bound to the host allowed to spend it, and lives for a minute.
 */
export const sessionTickets = pgTable(
  'session_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** SHA-256 of the ticket, never the ticket. Same reasoning as sessions. */
    tokenHash: text('token_hash').notNull(),

    /** The only hostname permitted to redeem it. */
    host: text('host').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    /** Set on redemption. Single use is enforced against this being NULL. */
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('session_tickets_token_hash_unique').on(table.tokenHash),
    index('session_tickets_expires_at_idx').on(table.expiresAt),
  ],
);

export type UserIdentityRow = typeof userIdentities.$inferSelect;
export type RecoveryCodeRow = typeof recoveryCodes.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type SessionTicketRow = typeof sessionTickets.$inferSelect;

/* -------------------------------------------------------------------------- */
/* First-party OAuth — how other surfaces get an authenticated subject          */
/* -------------------------------------------------------------------------- */

/**
 * An authorization code, in flight.
 *
 * Short-lived and single-use (V16). Stored hashed for the same reason a session
 * token is: what is in the database should not be usable if the database leaks.
 *
 * The code is bound to the client, the exact redirect it was issued for, and
 * the PKCE challenge — so a code intercepted in a redirect is worthless without
 * the verifier that never left the client.
 */
export const oauthCodes = pgTable(
  'oauth_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    codeHash: text('code_hash').notNull(),

    clientId: text('client_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Exact match, never a prefix (V14). */
    redirectUri: text('redirect_uri').notNull(),

    /** S256 only (V13). */
    codeChallenge: text('code_challenge').notNull(),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Set the moment it is spent, so a replay finds it already used. */
    usedAt: timestamp('used_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('oauth_codes_code_hash_unique').on(table.codeHash),
    index('oauth_codes_expires_at_idx').on(table.expiresAt),
  ],
);

/**
 * An access token, issued to a surface so it can ask who just signed in.
 *
 * Five minutes (V15). It exists to be spent once against `/oauth/userinfo` and
 * is not a session: the surface mints its own from what it learns (V3).
 */
export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    tokenHash: text('token_hash').notNull(),

    clientId: text('client_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('oauth_tokens_token_hash_unique').on(table.tokenHash),
    index('oauth_tokens_expires_at_idx').on(table.expiresAt),
  ],
);

export type OauthCodeRow = typeof oauthCodes.$inferSelect;
export type OauthTokenRow = typeof oauthTokens.$inferSelect;
