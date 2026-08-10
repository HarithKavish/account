/**
 * PHASE 1 ONLY — browser-local demonstration backend.
 *
 * ============================ READ THIS FIRST ============================
 * This is NOT authentication. It exists so the Account Platform UI can be
 * designed, navigated and reviewed before the real identity system is built in
 * Phases 2–4. Everything here runs in the visitor's own browser:
 *
 *   - There is no server, no database and no trust boundary.
 *   - Anyone with devtools can read and rewrite this store.
 *   - The salted SHA-256 digest below is a placeholder that keeps the entered
 *     password out of storage. It is NOT a password hashing function; Phase 3
 *     uses Argon2id server-side and the client never sees a hash at all.
 *
 * The UI warns the visitor not to enter a real password, and every capability
 * that would be security-sensitive to fake (passkeys, session management,
 * password change) reports itself as unavailable rather than pretending.
 *
 * Phase 3 deletes this file and drops in a `ServerAuthBackend` implementing the
 * same `AuthBackend` interface. No page or component should need to change.
 * ========================================================================
 */

import type {
  AccountSession,
  AccountUser,
  AuthBackend,
  AuthCapabilities,
  Passkey,
  ProfileInput,
  Result,
  SignInInput,
  SignUpInput,
} from './types';
import {
  normalizeName,
  normalizeUserId,
  toValidationError,
  validateProfile,
  validateSignIn,
  validateSignUp,
  hasErrors,
} from './validation';

const STORAGE_KEY = 'hk.account.demo.v1';

/** A user plus the demo-only credential marker. Never leaves this module. */
interface StoredUser extends AccountUser {
  /** salt:digest — see the file header for why this is not a password hash. */
  demoCredentialDigest: string;
}

interface StoreShape {
  version: 1;
  users: StoredUser[];
  /** AccountUser.id of the signed-in demo user, if any. */
  currentUserId: string | null;
}

const EMPTY_STORE: StoreShape = { version: 1, users: [], currentUserId: null };

/** Strips the demo credential marker so it can never reach a component. */
function toPublicUser(stored: StoredUser): AccountUser {
  const { demoCredentialDigest: _omitted, ...user } = stored;
  void _omitted;
  return user;
}

class StorageUnavailableError extends Error {
  constructor() {
    super('Browser storage is unavailable, so the demo session cannot be saved.');
    this.name = 'StorageUnavailableError';
  }
}

function readStore(): StoreShape {
  if (typeof window === 'undefined') return EMPTY_STORE;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked entirely (private mode, hardened settings). Surface it —
    // callers turn this into a visible message rather than a silent no-op.
    throw new StorageUnavailableError();
  }

  if (!raw) return EMPTY_STORE;

  try {
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    if (parsed?.version !== 1 || !Array.isArray(parsed.users)) return EMPTY_STORE;
    return {
      version: 1,
      users: parsed.users as StoredUser[],
      currentUserId: typeof parsed.currentUserId === 'string' ? parsed.currentUserId : null,
    };
  } catch {
    // Corrupted demo data is not worth recovering; start clean.
    return EMPTY_STORE;
  }
}

function writeStore(store: StoreShape): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    throw new StorageUnavailableError();
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `demo-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Demo-only credential marker. See the file header: this keeps the typed
 * password out of localStorage but provides no real protection and is replaced
 * wholesale in Phase 3.
 */
async function demoDigest(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function makeCredentialMarker(password: string): Promise<string> {
  const salt = randomSalt();
  return `${salt}:${await demoDigest(password, salt)}`;
}

async function credentialMatches(password: string, marker: string): Promise<boolean> {
  const [salt, expected] = marker.split(':');
  if (!salt || !expected) return false;
  return (await demoDigest(password, salt)) === expected;
}

/** Keeps the mock feeling like a network call so loading states are real. */
function settle<T>(value: T, ms = 320): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function storageError(error: unknown): Result<never> {
  if (error instanceof StorageUnavailableError) {
    return { ok: false, error: { code: 'storage_unavailable', message: error.message } };
  }
  throw error;
}

export class MockAuthBackend implements AuthBackend {
  readonly kind = 'mock' as const;

  /**
   * Phase 1 implements exactly one thing for real: navigating a designed UI.
   * Everything security-sensitive reports false so the UI can say so honestly
   * instead of simulating success.
   */
  readonly capabilities: AuthCapabilities = {
    realAuthentication: false,
    passkeys: false,
    sessionManagement: false,
    passwordChange: false,
  };

  async getCurrentUser(): Promise<AccountUser | null> {
    try {
      const store = readStore();
      if (!store.currentUserId) return null;
      const found = store.users.find((u) => u.id === store.currentUserId);
      return found ? toPublicUser(found) : null;
    } catch {
      // A read failure here just means "not signed in" for guard purposes; the
      // actionable message is raised on the next write attempt.
      return null;
    }
  }

  async signUp(input: SignUpInput): Promise<Result<AccountUser>> {
    const errors = validateSignUp(input);
    if (hasErrors(errors)) return { ok: false, error: toValidationError(errors) };

    try {
      const store = readStore();
      const userId = normalizeUserId(input.userId);

      if (store.users.some((u) => u.userId === userId)) {
        return {
          ok: false,
          error: {
            code: 'user_id_taken',
            message: 'That user ID is already taken in this demo. Try another.',
            field: 'userId',
          },
        };
      }

      const now = new Date().toISOString();
      const stored: StoredUser = {
        id: newId(),
        userId,
        firstName: normalizeName(input.firstName),
        lastName: normalizeName(input.lastName),
        createdAt: now,
        updatedAt: now,
        demoCredentialDigest: await makeCredentialMarker(input.password),
      };

      writeStore({
        version: 1,
        users: [...store.users, stored],
        currentUserId: stored.id,
      });

      return settle({ ok: true, data: toPublicUser(stored) });
    } catch (error) {
      return storageError(error);
    }
  }

  async signIn(input: SignInInput): Promise<Result<AccountUser>> {
    const errors = validateSignIn(input);
    if (hasErrors(errors)) return { ok: false, error: toValidationError(errors) };

    try {
      const store = readStore();
      const userId = normalizeUserId(input.userId);
      const found = store.users.find((u) => u.userId === userId);

      // Same message either way — no user-ID enumeration, matching the
      // behaviour Phase 3 must also have.
      const invalid: Result<AccountUser> = {
        ok: false,
        error: {
          code: 'invalid_credentials',
          message: 'That user ID and password combination was not found in this demo.',
        },
      };

      if (!found) return settle(invalid);
      if (!(await credentialMatches(input.password, found.demoCredentialDigest))) {
        return settle(invalid);
      }

      writeStore({ ...store, currentUserId: found.id });
      return settle({ ok: true, data: toPublicUser(found) });
    } catch (error) {
      return storageError(error);
    }
  }

  async signOut(): Promise<void> {
    try {
      const store = readStore();
      writeStore({ ...store, currentUserId: null });
    } catch {
      // Signing out must never block the user; the redirect still happens and
      // the in-memory session is cleared by the caller regardless.
    }
  }

  async updateProfile(input: ProfileInput): Promise<Result<AccountUser>> {
    const errors = validateProfile(input);
    if (hasErrors(errors)) return { ok: false, error: toValidationError(errors) };

    try {
      const store = readStore();
      const index = store.users.findIndex((u) => u.id === store.currentUserId);
      if (index === -1) {
        return {
          ok: false,
          error: { code: 'not_authenticated', message: 'Sign in again to update your profile.' },
        };
      }

      const updated: StoredUser = {
        ...store.users[index],
        firstName: normalizeName(input.firstName),
        lastName: normalizeName(input.lastName),
        updatedAt: new Date().toISOString(),
      };

      const users = [...store.users];
      users[index] = updated;
      writeStore({ ...store, users });

      return settle({ ok: true, data: toPublicUser(updated) });
    } catch (error) {
      return storageError(error);
    }
  }

  /** Phase 4. Returning empty is honest; the UI renders the unavailable state. */
  async listPasskeys(): Promise<Passkey[]> {
    return [];
  }

  /** Phase 3/5. Same reasoning as passkeys — no invented session rows. */
  async listSessions(): Promise<AccountSession[]> {
    return [];
  }
}
