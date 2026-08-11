import 'server-only';

import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id. Written as a literal rather than imported, because the package
 * declares `Algorithm` as an ambient const enum, which `isolatedModules`
 * (required by Next.js) cannot reference at runtime.
 */
const ARGON2ID = 2;

/**
 * Password hashing for the Account Platform.
 *
 * The Account Platform owns the account's credentials as stored data: it is
 * what hashes a password on creation and on change. The Authentication Platform
 * owns the act of authenticating with them. `verifyPassword` exists here for
 * lifecycle operations that require re-proving a password (changing it, or
 * confirming a deletion) — not to implement a login.
 *
 * Argon2id with OWASP's recommended floor: 19 MiB of memory, 2 iterations,
 * 1 degree of parallelism. Parameters are encoded in the hash itself, so
 * raising them later does not invalidate existing hashes.
 */
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456, // KiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, ARGON2_OPTIONS);
}

/**
 * Constant-time comparison is handled inside Argon2. Returns false rather than
 * throwing on a malformed stored hash, so a corrupt row cannot be told apart
 * from a wrong password by timing or by error text.
 */
export async function verifyPassword(storedHash: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(storedHash, plaintext, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
