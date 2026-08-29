/**
 * Domain types for the HarithKavish Account Platform.
 *
 * This half owns the account lifecycle: the person, and how they can prove they
 * are them. The fact that someone proved it just now is a session, owned by the
 * authentication half in `lib/auth` (contract §0.5).
 */

/** An account as it may be shown to a client. Never carries the hash. */
export interface AccountProfile {
  /** Internal identifier. Never used as a login identity. */
  id: string;
  /**
   * The public identifier the user signs in with, stored lowercase.
   * `null` for someone who arrived through a provider and never chose one
   * (§6.4) — it is not generated on their behalf.
   */
  userId: string | null;
  firstName: string;
  lastName: string;
  status: 'active' | 'deletion_requested' | 'deleted';
  createdAt: string;
  updatedAt: string;
}

export type AccountErrorCode =
  | 'validation_failed'
  | 'user_id_taken'
  | 'rate_limited'
  | 'rate_limit_unavailable'
  | 'database_unavailable'
  | 'account_unavailable'
  | 'unexpected';

export interface AccountError {
  code: AccountErrorCode;
  message: string;
  /** Form field the message belongs against, when field-specific. */
  field?: string;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AccountError };

export interface CreateAccountInput {
  firstName: string;
  lastName: string;
  userId: string;
  password: string;
  confirmPassword: string;
}

/* -------------------------------------------------------------------------- */
/* Federation and recovery                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A provider assertion the authentication half has already verified.
 *
 * The account half performs no provider validation — it trusts the half that
 * checked the signature, issuer, audience, expiry and nonce, exactly as the
 * contract's §5.10 has Account trusting Auth rather than the token.
 */
export interface VerifiedProviderIdentity {
  /** e.g. `https://accounts.google.com`. */
  issuer: string;
  /** The provider's `sub`. Opaque. */
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  /** The provider's picture, as last asserted. Display only, and expires. */
  picture: string | null;
}

export interface ResolvedIdentity {
  profile: AccountProfile;
  /**
   * Did this sign-in bring a new person into the ecosystem?
   *
   * The authentication half needs it to know whether recovery codes are owed
   * before the session is usable — a federated-only account has one way in and
   * the ecosystem does not control it.
   */
  created: boolean;
}
