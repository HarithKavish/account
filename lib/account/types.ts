/**
 * Domain types for the HarithKavish Account Platform.
 *
 * This platform owns the account lifecycle. It does not model authentication
 * sessions — those belong to the Authentication Platform
 * (auth.harithkavish.com) and must not reappear here.
 */

/**
 * human | ai. Phase 1 of the human/agent platform: every account created
 * through the current signup flow is 'human'. No code path can produce 'ai'
 * yet -- that is a deliberately separate, later piece of work.
 */
export type AccountType = 'human' | 'ai';

/** An account as it may be shown to a client. Never carries the hash. */
export interface AccountProfile {
  /** Internal identifier. Never used as a login identity. */
  id: string;
  /** The public identifier the user signs in with, stored lowercase. */
  userId: string;
  accountType: AccountType;
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
