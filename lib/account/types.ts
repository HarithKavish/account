/**
 * Domain types for the HarithKavish Account Platform.
 *
 * These mirror the Phase 2 PostgreSQL schema so that swapping the Phase 1 mock
 * store for the real database does not change any consumer. Note in particular
 * that `id` (internal, stable, UUID) is distinct from `userId` (the public
 * login identifier the user types), and that nothing password-related is ever
 * part of a client-visible type.
 */

/** A user as the client is ever allowed to see them. Never carries a hash. */
export interface AccountUser {
  /** Internal stable identifier. UUID in Phase 2. */
  id: string;
  /** Public login identifier chosen by the user. Unique, case-insensitive. */
  userId: string;
  firstName: string;
  lastName: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** ISO-8601 timestamp. */
  updatedAt: string;
}

/**
 * A registered WebAuthn credential. Phase 4 populates this; Phase 1 only needs
 * the shape so the UI and storage layer are already correct.
 * Private key material never leaves the authenticator and is never stored.
 */
export interface Passkey {
  id: string;
  /** References AccountUser.id — not the public login identifier. */
  userId: string;
  credentialId: string;
  publicKey: string;
  signCount: number;
  /** User-facing name, e.g. "Windows Hello on Surface". */
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** An authenticated session. Phase 3 makes these real, server-side records. */
export interface AccountSession {
  id: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
  /** Coarse description of the client, e.g. "Chrome on Windows". */
  client: string;
  /** True for the session making the current request. */
  current: boolean;
}

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'user_id_taken'
  | 'validation_failed'
  | 'not_authenticated'
  | 'not_implemented'
  | 'storage_unavailable';

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  /** Form field the message belongs against, when the error is field-specific. */
  field?: string;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AuthError };

export interface SignUpInput {
  firstName: string;
  lastName: string;
  userId: string;
  password: string;
  confirmPassword: string;
}

export interface SignInInput {
  userId: string;
  password: string;
}

export interface ProfileInput {
  firstName: string;
  lastName: string;
}

/**
 * What the currently-installed backend can actually do. The UI reads this
 * instead of hardcoding "coming soon", so Phases 3–5 light up their sections by
 * flipping a flag rather than by editing pages.
 */
export interface AuthCapabilities {
  /** Credentials are verified by a server against a real password hash. */
  realAuthentication: boolean;
  passkeys: boolean;
  sessionManagement: boolean;
  passwordChange: boolean;
}

/**
 * The contract every backend implements. Phase 1 ships `MockAuthBackend`;
 * Phase 3 replaces it with a server-backed implementation of this same
 * interface. Consumers (context, pages, components) must depend only on this.
 */
export interface AuthBackend {
  /** Identifies the implementation. Drives the demo banner. */
  readonly kind: 'mock' | 'server';
  readonly capabilities: AuthCapabilities;

  getCurrentUser(): Promise<AccountUser | null>;
  signUp(input: SignUpInput): Promise<Result<AccountUser>>;
  signIn(input: SignInInput): Promise<Result<AccountUser>>;
  signOut(): Promise<void>;
  updateProfile(input: ProfileInput): Promise<Result<AccountUser>>;
  listPasskeys(): Promise<Passkey[]>;
  listSessions(): Promise<AccountSession[]>;
}
