import 'server-only';

import { and, eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db/client';
import { defaultDisplayName } from './passkeys-naming';
import type { Result } from './types';

export { defaultDisplayName };

/**
 * Passkeys held by an account.
 *
 * A passkey is a way of proving an account, exactly like a provider link. This
 * module owns the records; the ceremony that creates one lives in the routes,
 * and the cryptography lives in the library. Nothing here decides whether an
 * assertion was valid.
 */

export interface Passkey {
  id: string;
  displayName: string;
  transports: string[];
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Every passkey on an account, newest first. Public fields only. */
export async function listPasskeys(userId: string): Promise<Passkey[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.webauthnCredentials)
    .where(eq(schema.webauthnCredentials.userId, userId));

  return rows
    .map((row) => ({
      id: row.id,
      displayName: row.displayName,
      transports: row.transports ? (JSON.parse(row.transports) as string[]) : [],
      deviceType: row.deviceType,
      backedUp: row.backedUp,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * What the credential id resolves to.
 *
 * This is the whole of username-less sign-in: the authenticator picks a
 * credential, and the account is whatever that credential belongs to. Nothing is
 * enumerated and nothing is guessed.
 */
export async function findByCredentialId(credentialId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.webauthnCredentials)
    .where(eq(schema.webauthnCredentials.credentialId, credentialId))
    .limit(1);

  return rows[0] ?? null;
}

export async function saveCredential(input: {
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType: string | null;
  backedUp: boolean;
}): Promise<Result<Passkey>> {
  const db = getDb();

  try {
    const inserted = await db
      .insert(schema.webauthnCredentials)
      .values({
        userId: input.userId,
        credentialId: input.credentialId,
        publicKey: input.publicKey,
        counter: input.counter,
        transports: JSON.stringify(input.transports),
        deviceType: input.deviceType,
        backedUp: input.backedUp,
        displayName: defaultDisplayName(input.transports, input.deviceType),
      })
      .returning();

    const row = inserted[0];

    await db.insert(schema.accountEvents).values({
      userId: input.userId,
      type: 'identity_linked',
      metadata: { method: 'passkey' },
    });

    return {
      ok: true,
      data: {
        id: row.id,
        displayName: row.displayName,
        transports: input.transports,
        deviceType: row.deviceType,
        backedUp: row.backedUp,
        createdAt: row.createdAt.toISOString(),
        lastUsedAt: null,
      },
    };
  } catch {
    // The unique index on credential_id is what actually guarantees a credential
    // reaches one account, and it just did.
    return {
      ok: false,
      error: {
        code: 'validation_failed',
        message: 'That passkey is already registered.',
      },
    };
  }
}

/** Record that a credential was used, and carry its counter forward. */
export async function markUsed(id: string, counter: number): Promise<void> {
  const db = getDb();
  await db
    .update(schema.webauthnCredentials)
    .set({ counter, lastUsedAt: new Date() })
    .where(eq(schema.webauthnCredentials.id, id));
}

/**
 * Remove one passkey belonging to one account.
 *
 * Ownership is part of the WHERE clause rather than checked before it. A
 * credential id supplied by a client is a request, not a fact, and the only
 * query that cannot delete someone else's credential is one that could never
 * match it.
 */
export async function removePasskey(userId: string, id: string): Promise<boolean> {
  const db = getDb();
  const removed = await db
    .delete(schema.webauthnCredentials)
    .where(
      and(eq(schema.webauthnCredentials.id, id), eq(schema.webauthnCredentials.userId, userId)),
    )
    .returning({ id: schema.webauthnCredentials.id });

  if (removed.length > 0) {
    await db.insert(schema.accountEvents).values({
      userId,
      type: 'identity_unlinked',
      metadata: { method: 'passkey' },
    });
  }

  return removed.length > 0;
}

/** Rename a passkey. Same ownership rule as removal. */
export async function renamePasskey(
  userId: string,
  id: string,
  displayName: string,
): Promise<boolean> {
  const name = displayName.trim().slice(0, 60);
  if (!name) return false;

  const db = getDb();
  const updated = await db
    .update(schema.webauthnCredentials)
    .set({ displayName: name })
    .where(
      and(eq(schema.webauthnCredentials.id, id), eq(schema.webauthnCredentials.userId, userId)),
    )
    .returning({ id: schema.webauthnCredentials.id });

  return updated.length > 0;
}
