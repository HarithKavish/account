import 'server-only';

import { randomBytes } from 'node:crypto';

import { hashPassword, verifyPassword } from './password';

/**
 * Recovery codes — contract §6.1, §7.5.
 *
 * The way back in when the only way in is gone. A federated-only account has
 * exactly one way in and the ecosystem does not control it: a disabled Google
 * account would otherwise be permanent lockout. This is why the contract puts
 * recovery ahead of federation rather than after it.
 *
 * Codes are hashed with the same function as passwords, because that is what
 * they are for the moment they are used.
 */

/** Ten codes is enough to survive losing a few and still be worth printing. */
export const RECOVERY_CODE_COUNT = 10;

/**
 * Crockford base32 without I, L, O and U — no character a person can misread as
 * another, and none that can accidentally spell a word.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUP = 5;
const GROUPS = 2;

/**
 * 50 bits of entropy per code. Not a password: it is single-use, rate-limited,
 * and there are only ten of them, so the useful attack is guessing one before
 * the limiter closes rather than exhausting the space.
 */
function generateCode(): string {
  const bytes = randomBytes(GROUP * GROUPS);
  let out = '';
  for (let i = 0; i < GROUP * GROUPS; i += 1) {
    if (i > 0 && i % GROUP === 0) out += '-';
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export interface GeneratedRecoveryCodes {
  /** Shown once, never stored, never logged. */
  plaintext: string[];
  /** What goes to the database. */
  hashes: string[];
}

export async function generateRecoveryCodes(): Promise<GeneratedRecoveryCodes> {
  const plaintext = Array.from({ length: RECOVERY_CODE_COUNT }, generateCode);
  const hashes = await Promise.all(plaintext.map((code) => hashPassword(code)));
  return { plaintext, hashes };
}

/** Normalised before comparison, so case and spacing do not decide the outcome. */
export function normalizeRecoveryCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/**
 * Compare a presented code against one stored hash.
 *
 * The caller checks every unused code rather than looking one up, because there
 * is nothing to look it up by — the hash is not reversible, which is the point.
 */
export async function recoveryCodeMatches(hash: string, presented: string): Promise<boolean> {
  return verifyPassword(hash, presented);
}
