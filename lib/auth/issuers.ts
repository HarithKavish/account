import 'server-only';

import { GOOGLE_ISSUER } from './google';
import { GRAVATAR_ISSUER } from './gravatar';

/**
 * What a linked provider is *for*.
 *
 * `user_identities` holds two different kinds of thing under one schema, and
 * nothing in the row says which is which. Google is a way to prove an account:
 * its callback resolves an identity and issues a session. Gravatar is not, and
 * says so in its own module — "deliberately not a way to sign in" — because its
 * callback has no sign-in branch at all, refuses without a session already in
 * hand, and lends the account a picture and a profile.
 *
 * A reader that treats every link as a way in therefore reports that someone can
 * sign in with Gravatar, which is false and is exactly the sort of false thing a
 * security surface must not say.
 *
 * The distinction lives in the callbacks, so it cannot be derived from the data.
 * It is written down here instead, once, rather than re-guessed by each reader.
 * **A new provider must be added to this map when its callback is written** — an
 * unknown issuer is treated as a connection, so the failure is a provider that
 * is under-reported rather than one credited with powers it does not have.
 */
export type IssuerRole = 'authenticator' | 'connection';

const ROLES: Readonly<Record<string, IssuerRole>> = {
  [GOOGLE_ISSUER]: 'authenticator',
  // The bare form `lib/auth/google.ts` also accepts from an ID token's `iss`.
  'accounts.google.com': 'authenticator',
  [GRAVATAR_ISSUER]: 'connection',
};

export function issuerRole(issuer: string): IssuerRole {
  return ROLES[issuer] ?? 'connection';
}

/** Whether this provider can sign someone in, as opposed to merely being linked. */
export function isAuthenticator(issuer: string): boolean {
  return issuerRole(issuer) === 'authenticator';
}
