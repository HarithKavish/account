import 'server-only';

import { cookies } from 'next/headers';

import type { FlowSecrets } from './google';
import { AUTH_HOST } from './hosts';

/**
 * The in-flight provider round trip.
 *
 * `state`, `nonce` and the PKCE verifier only mean anything to the browser that
 * started the flow, so they travel in a host-only cookie rather than a server
 * row. Ten minutes is longer than a sign-in takes and short enough that an
 * abandoned attempt cannot be resumed later.
 */
const COOKIE = '__Host-hk_oauth';
const TTL_SECONDS = 600;

/**
 * What the round trip is for.
 *
 * `sign-in` may create an account; `link` never may — it joins a provider to the
 * account already holding the session. Carried in the flow cookie rather than in
 * the callback URL so it cannot be switched by editing the address someone comes
 * back to.
 */
export type FlowMode = 'sign-in' | 'link';

interface FlowState extends FlowSecrets {
  /** Where to land afterwards. Validated on the way out, never trusted verbatim. */
  next: string | null;
  mode: FlowMode;
}

/**
 * The redirect URI must match Google's registration exactly (V14).
 *
 * Pinned to the front door rather than derived from whichever host served the
 * request. Deriving it meant the URI changed with the address someone happened
 * to start from, so a flow begun on the account host sent a URI that is not
 * registered and Google refused it — the failure this constant exists to make
 * impossible. One front door, one URI, one entry in the console.
 */
export function redirectUri(): string {
  return `https://${AUTH_HOST}/api/auth/google/callback`;
}

export async function setFlowCookie(
  secrets: FlowSecrets,
  next: string | null,
  mode: FlowMode = 'sign-in',
): Promise<void> {
  const jar = await cookies();
  const state: FlowState = { ...secrets, next, mode };
  jar.set(COOKIE, JSON.stringify(state), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

export async function takeFlowCookie(): Promise<FlowState | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  // Single use: cleared whether or not it parses, so a failed attempt cannot be
  // replayed with the same state.
  jar.delete(COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FlowState;
    if (!parsed.state || !parsed.nonce || !parsed.codeVerifier) return null;
    // A cookie written before `mode` existed is a sign-in, which is what every
    // flow was until linking arrived.
    return { ...parsed, mode: parsed.mode === 'link' ? 'link' : 'sign-in' };
  } catch {
    return null;
  }
}

/**
 * Where to send someone after they sign in.
 *
 * Every surface in the ecosystem sends people here, so a return has to be able
 * to cross subdomains — blog sends them, blog gets them back. That makes this
 * the most attackable parameter on the service: an open redirect on a sign-in
 * route hands an attacker a link that looks entirely genuine and lands
 * somewhere else.
 *
 * So it is an allow-list, not a filter. A relative path stays here. An absolute
 * URL is honoured only when it is https and its host is harithkavish.com or a
 * subdomain of it — compared against the parsed hostname, never by prefix or
 * `includes`, because `harithkavish.com.attacker.test` passes both of those.
 */
const ECOSYSTEM = 'harithkavish.com';

export function safeNext(next: string | null): string {
  if (!next) return '/account';

  // A relative path. `//host` is protocol-relative and would leave the site.
  if (next.startsWith('/') && !next.startsWith('//')) {
    /*
     * Normalised rather than returned as given.
     *
     * `searchParams` hands back a decoded value, so a query that arrived as
     * `scope=openid+profile` reaches here as `scope=openid profile` — a literal
     * space. Redirecting to that produces a URL the browser refuses, and the
     * failure looks like the sign-in broke rather than like the address did.
     *
     * Parsing and re-serialising puts the encoding back.
     */
    try {
      const relative = new URL(next, 'https://placeholder.invalid');
      return relative.pathname + relative.search + relative.hash;
    } catch {
      return '/account';
    }
  }

  try {
    const url = new URL(next);
    if (url.protocol !== 'https:') return '/account';
    const host = url.hostname.toLowerCase();
    if (host === ECOSYSTEM || host.endsWith(`.${ECOSYSTEM}`)) return url.toString();
  } catch {
    // Not a URL at all.
  }
  return '/account';
}
