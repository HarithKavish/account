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
 * It deliberately contains NO authentication session tables. Establishing and
 * maintaining a login session is the Authentication Platform's responsibility
 * (auth.harithkavish.com). The password hash lives here because the account's
 * credentials are lifecycle data owned by the account; the act of verifying
 * them belongs to Auth.
 *
 * There is no `passkeys` table yet, by design. Passkey material is only worth
 * storing once the Account/Auth contract defines who registers credentials and
 * who verifies them. Adding the table before that would guess at the answer.
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
     * The public login identifier the user chooses and types.
     * Stored lowercase so uniqueness is case-insensitive.
     */
    userId: text('user_id').notNull(),

    /** Argon2id encoded hash. Never returned to a client, never logged. */
    passwordHash: text('password_hash').notNull(),

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
