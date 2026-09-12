import 'server-only';

import { eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db/client';
import { hashPassword, verifyPassword } from './password';
import { isUserIdAvailable } from './service';
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  hasErrors,
  normalizeName,
  normalizeUserId,
  validateUserId,
  toValidationError,
  validateProfile,
} from './validation';
import type { AccountProfile, Result } from './types';

/**
 * Managing an account that already exists — the half of the lifecycle that
 * `service.ts` does not cover.
 *
 * Everything here is performed on behalf of a session that has already been
 * verified. Nothing in this module authenticates: the caller establishes who is
 * asking, and this decides only whether what they are asking is allowed.
 */

function toProfile(row: schema.UserRow): AccountProfile {
  return {
    id: row.id,
    userId: row.userId,
    accountType: row.accountType,
    email: row.email,
    emailVerified: row.emailVerifiedAt !== null,
    firstName: row.firstName,
    lastName: row.lastName,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Whether this account has a password at all.
 *
 * NULL in `password_hash` means someone arrived through a provider and has never
 * set one (§6.4), which changes what the security page may ask them for. Only
 * the fact is returned; the hash never leaves this module.
 */
export async function hasPassword(userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  return Boolean(rows[0]?.passwordHash);
}

/** Change the name shown across the ecosystem. */
export async function updateName(
  userId: string,
  input: { firstName: string; lastName: string },
): Promise<Result<AccountProfile>> {
  const firstName = normalizeName(input.firstName);
  const lastName = normalizeName(input.lastName);

  const errors = validateProfile({ firstName, lastName });
  if (hasErrors(errors)) return { ok: false, error: toValidationError(errors) };

  const db = getDb();
  const updated = await db
    .update(schema.users)
    .set({ firstName, lastName, updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning();

  const row = updated[0];
  if (!row) {
    return { ok: false, error: { code: 'account_unavailable', message: 'Account not found.' } };
  }

  await db.insert(schema.accountEvents).values({ userId, type: 'profile_updated' });

  return { ok: true, data: toProfile(row) };
}

/**
 * Choose a user ID, once.
 *
 * Only for an account that has none — someone who arrived through a provider and
 * never needed one (§6.4). It is not a rename: the ID is what other people may
 * have learned to call this account, and letting it move would let someone
 * release a name and take it back with a different account behind it.
 */
export async function chooseUserId(
  userId: string,
  rawChoice: string,
): Promise<Result<AccountProfile>> {
  const choice = normalizeUserId(rawChoice);

  const invalid = validateUserId(choice);
  if (invalid) {
    return { ok: false, error: { code: 'validation_failed', message: invalid, field: 'userId' } };
  }

  const db = getDb();
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const user = rows[0];

  if (!user || user.status === 'deleted') {
    return { ok: false, error: { code: 'account_unavailable', message: 'Account not found.' } };
  }

  if (user.userId) {
    return {
      ok: false,
      error: {
        code: 'validation_failed',
        message: 'This account already has a user ID.',
        field: 'userId',
      },
    };
  }

  if (!(await isUserIdAvailable(choice))) {
    return {
      ok: false,
      error: { code: 'user_id_taken', message: 'That user ID is taken.', field: 'userId' },
    };
  }

  try {
    const updated = await db
      .update(schema.users)
      .set({ userId: choice, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning();

    await db.insert(schema.accountEvents).values({ userId, type: 'profile_updated' });

    return { ok: true, data: toProfile(updated[0]) };
  } catch {
    // Someone took it between the check and the write. The unique index is what
    // actually guarantees this, and it just did.
    return {
      ok: false,
      error: { code: 'user_id_taken', message: 'That user ID is taken.', field: 'userId' },
    };
  }
}

/**
 * Set or change the password.
 *
 * An account that has never had one — someone who arrived through a provider and
 * is adding a second way in — has nothing to prove, and is not asked to invent
 * something to type. An account that has one must prove it: a session left open
 * on a shared machine is not consent to change the credential.
 */
export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string; confirmPassword: string },
): Promise<Result<{ hadPassword: boolean }>> {
  const db = getDb();
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const user = rows[0];

  if (!user || user.status === 'deleted') {
    return { ok: false, error: { code: 'account_unavailable', message: 'Account not found.' } };
  }

  const hadPassword = Boolean(user.passwordHash);

  if (hadPassword) {
    const matched = await verifyPassword(user.passwordHash!, input.currentPassword);
    if (!matched) {
      return {
        ok: false,
        error: {
          code: 'validation_failed',
          message: 'That is not your current password.',
          field: 'currentPassword',
        },
      };
    }
  }

  if (input.newPassword !== input.confirmPassword) {
    return {
      ok: false,
      error: {
        code: 'validation_failed',
        message: 'Those passwords do not match.',
        field: 'confirmPassword',
      },
    };
  }

  if (input.newPassword.length < PASSWORD_MIN) {
    return {
      ok: false,
      error: {
        code: 'validation_failed',
        message: `Use at least ${PASSWORD_MIN} characters.`,
        field: 'newPassword',
      },
    };
  }
  if (input.newPassword.length > PASSWORD_MAX) {
    return {
      ok: false,
      error: {
        code: 'validation_failed',
        message: `Use at most ${PASSWORD_MAX} characters.`,
        field: 'newPassword',
      },
    };
  }

  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(input.newPassword), updatedAt: new Date() })
    .where(eq(schema.users.id, userId));

  await db.insert(schema.accountEvents).values({
    userId,
    type: 'password_changed',
    metadata: { first: !hadPassword },
  });

  return { ok: true, data: { hadPassword } };
}

/**
 * Delete the account, for good.
 *
 * A hard delete rather than a status change: the sessions, provider links and
 * recovery codes go with it by cascade, and the user ID becomes available again
 * — which a tombstone row would hold hostage forever. The audit trail survives
 * because `account_events.user_id` is ON DELETE SET NULL, and it carries no copy
 * of the name or user ID, so nothing about the person outlives the deletion.
 */
export async function deleteAccount(userId: string): Promise<Result<null>> {
  const db = getDb();

  // Recorded first: after the DELETE the row is gone, and an event written
  // afterwards would have nothing to be about.
  await db.insert(schema.accountEvents).values({ userId, type: 'account_deleted' });

  const removed = await db
    .delete(schema.users)
    .where(eq(schema.users.id, userId))
    .returning({ id: schema.users.id });

  if (!removed[0]) {
    return { ok: false, error: { code: 'account_unavailable', message: 'Account not found.' } };
  }

  return { ok: true, data: null };
}
