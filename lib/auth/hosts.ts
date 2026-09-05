/**
 * The two hostnames this one deployable answers to (contract §0.5).
 *
 * `auth` is the front door: signing in begins there and nowhere else, so the
 * provider round trip has exactly one redirect URI to register (V14). `account`
 * is where someone manages the account behind it.
 *
 * They are one application but two security origins, because a cookie's scope is
 * a host and not a codebase. Everything about the handoff follows from that.
 */
export const AUTH_HOST = 'auth.harithkavish.com';
export const ACCOUNT_HOST = 'account.harithkavish.com';

/**
 * Hosts allowed to redeem a ticket for a session of their own.
 *
 * An allow-list rather than "any subdomain": a ticket names the host that may
 * spend it, and that host must be one we run this code on. The static sites on
 * `*.harithkavish.com` are not, and must never be able to hold a session.
 */
const ADOPT_HOSTS: readonly string[] = [ACCOUNT_HOST];

export function isAdoptHost(host: string): boolean {
  return ADOPT_HOSTS.includes(host.toLowerCase());
}

/**
 * Where the middleware records the path it saw.
 *
 * A server component has no way to ask for its own URL, and the internal headers
 * Next happens to set are not a documented contract.
 */
export const PATH_HEADER = 'x-hk-pathname';

/** The hostname this request arrived on, lowercased and without any port. */
export function hostOf(headerValue: string | null): string {
  return headerValue?.split(':')[0].toLowerCase() ?? '';
}
