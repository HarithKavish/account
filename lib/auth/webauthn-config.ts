import { ACCOUNT_HOST, AUTH_HOST } from './hosts';

/**
 * Where a WebAuthn ceremony is allowed to happen.
 *
 * Deliberately free of `server-only` and of any request-scoped import, so the
 * rules can be read — and checked — without a running server. Nothing here is a
 * secret; it is the statement of which domain and which origins this service
 * will accept, which is exactly the part worth being able to assert against.
 */

/**
 * The Relying Party is the domain, not a host.
 *
 * `harithkavish.com` rather than `auth.harithkavish.com`, because a credential
 * is scoped to its RP ID and the ecosystem is many hosts. Registering under the
 * apex means a passkey created while managing the account works when signing in
 * at the front door, and would keep working if a third host ever joined them.
 *
 * An RP ID must be the origin's own domain or a registrable suffix of it, which
 * is what makes this legal from both hosts and illegal from anywhere else.
 */
export const RP_ID = process.env.WEBAUTHN_RP_ID?.trim() || 'harithkavish.com';

export const RP_NAME = 'HarithKavish';

/**
 * Origins allowed to complete a ceremony — an explicit list, never a pattern.
 *
 * A wildcard here would accept any subdomain, including ones served by other
 * people's infrastructure on this very domain. The two entries are the two hosts
 * this application answers to: the front door signs people in, the account host
 * registers new credentials.
 *
 * Development adds its own origin through an environment variable, so a local
 * setup never requires loosening what production accepts.
 */
export function allowedOrigins(): string[] {
  const origins = [`https://${AUTH_HOST}`, `https://${ACCOUNT_HOST}`];

  const extra = process.env.WEBAUTHN_DEV_ORIGIN?.trim();
  // Only ever additive, and only where a deployment has explicitly asked for it.
  // Production sets nothing, so production accepts nothing else.
  if (extra) origins.push(extra);

  return origins;
}

