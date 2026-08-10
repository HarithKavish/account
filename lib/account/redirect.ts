/**
 * Post-authentication redirect handling.
 *
 * The `next` parameter is attacker-controllable, so it is only ever honoured
 * when it is a same-origin absolute path. Anything else falls back to /account.
 * Read from `window.location` rather than `useSearchParams` so that the auth
 * pages stay statically prerenderable.
 */

export const DEFAULT_DESTINATION = '/account';

export function isSafeInternalPath(path: string | null | undefined): path is string {
  if (!path) return false;
  // Reject protocol-relative ("//host") and any absolute URL; require a path.
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
}

export function safeNextPath(path: string | null | undefined): string {
  return isSafeInternalPath(path) ? path : DEFAULT_DESTINATION;
}

/** Resolves the `next` query parameter of the current URL, safely. */
export function readNextPath(): string {
  if (typeof window === 'undefined') return DEFAULT_DESTINATION;
  return safeNextPath(new URLSearchParams(window.location.search).get('next'));
}
