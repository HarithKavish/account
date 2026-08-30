import 'server-only';

import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { hashPassword } from './password';
import { checkSignupRateLimit } from './rate-limit';
import type { AccountProfile, CreateAccountInput, Result } from './types';
import {
  hasErrors,
  normalizeEmail,
  normalizeName,
  normalizeUserId,
  toValidationError,
  validateCreateAccount,
} from './validation';

/** Postgres unique-violation. */
const UNIQUE_VIOLATION = '23505';

function toProfile(row: typeof schema.users.$inferSelect): AccountProfile {
  // Constructed field by field so a schema change can never accidentally
  // spread `passwordHash` into something the client receives.
  return {
    id: row.id,
    userId: row.userId ?? null,
    email: row.email,
    emailVerified: row.emailVerifiedAt !== null,
    firstName: row.firstName,
    lastName: row.lastName,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION;
}

const takenError = (userId: string): Result<never> => ({
  ok: false,
  error: {
    code: 'user_id_taken',
    message: `"${userId}" is already taken. Try another user ID.`,
    field: 'userId',
  },
});

/**
 * Is this user ID free? Advisory only — the unique index is what actually
 * guarantees it, since another signup can land between this check and the
 * insert.
 */
export async function isUserIdAvailable(rawUserId: string): Promise<boolean> {
  const userId = normalizeUserId(rawUserId);
  const db = getDb();
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.userId, userId))
    .limit(1);
  return existing.length === 0;
}

/**
 * Creates a real account.
 *
 * Deliberately does NOT establish any kind of session: the Account Platform has
 * no login. Authentication happens at auth.harithkavish.com.
 */
export async function createAccount(input: CreateAccountInput): Promise<Result<AccountProfile>> {
  // 1. Server-side validation. The client validates too, for speed of feedback,
  //    but this is the authoritative check.
  const errors = validateCreateAccount(input);
  if (hasErrors(errors)) {
    return { ok: false, error: toValidationError(errors) };
  }

  // 2. Rate limit before doing any expensive work. Argon2 is deliberately slow,
  //    so hashing first would itself be the denial-of-service.
  const limit = await checkSignupRateLimit();
  if (!limit.allowed) {
    if (limit.reason === 'unavailable') {
      return {
        ok: false,
        error: {
          code: 'rate_limit_unavailable',
          message: 'Account creation is temporarily unavailable. Please try again shortly.',
        },
      };
    }
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    return {
      ok: false,
      error: {
        code: 'rate_limited',
        message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      },
    };
  }

  const email = normalizeEmail(input.email);
  const userId = normalizeUserId(input.userId);
  const firstName = normalizeName(input.firstName);
  const lastName = normalizeName(input.lastName);

  try {
    const db = getDb();

    // 3. Friendly pre-check so the common case gets a clear message rather than
    //    a constraint error. Not relied upon for correctness.
    if (!(await isUserIdAvailable(userId))) {
      return takenError(userId);
    }

    const passwordHash = await hashPassword(input.password);

    // 4. The account and its creation event are written together: an account
    //    with no audit trail, or an event for an account that failed to insert,
    //    would both be wrong.
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.users)
        /*
         * Stored, and deliberately not marked verified.
         *
         * Nothing here has proved this address — no message is sent, and typing
         * it proves only that it was typed. It stays unproved until a provider
         * asserts it for this account, which is what makes it safe for the
         * address to be matched on at all.
         */
        .values({ userId, passwordHash, firstName, lastName, email })
        .returning();

      await tx.insert(schema.accountEvents).values({
        userId: row.id,
        type: 'account_created',
        // Non-sensitive context only — never credential material.
        metadata: { source: 'account_platform_signup' },
      });

      return row;
    });

    return { ok: true, data: toProfile(created) };
  } catch (error) {
    // The unique index is the real guarantee; this catches the race the
    // pre-check cannot.
    if (isUniqueViolation(error)) {
      return takenError(userId);
    }

    // Log the failure without the input: it contains a plaintext password.
    console.error('[account] createAccount failed', {
      name: error instanceof Error ? error.name : 'unknown',
      message: error instanceof Error ? error.message : String(error),
    });

    return {
      ok: false,
      error: {
        code: 'database_unavailable',
        message: 'Could not create your account right now. Please try again.',
      },
    };
  }
}
