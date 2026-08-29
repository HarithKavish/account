import 'server-only';

import { cookies } from 'next/headers';

import type { FlowSecrets } from './google';

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

interface FlowState extends FlowSecrets {
  /** Where to land afterwards. Validated on the way out, never trusted verbatim. */
  next: string | null;
}

/** The redirect URI must match Google's registration exactly (V14). */
export function redirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

export async function setFlowCookie(secrets: FlowSecrets, next: string | null): Promise<void> {
  const jar = await cookies();
  const state: FlowState = { ...secrets, next };
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
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Only same-origin paths are honoured.
 *
 * An open redirect on a sign-in route hands an attacker a link that looks like
 * the real thing and lands somewhere else.
 */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/account';
  return next;
}
