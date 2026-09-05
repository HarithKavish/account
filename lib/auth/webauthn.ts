import 'server-only';

import { cookies } from 'next/headers';

export { RP_ID, RP_NAME, allowedOrigins } from './webauthn-config';


/**
 * WebAuthn configuration and the in-flight challenge.
 *
 * Passkeys are a way of proving a HarithKavish account, held beside password and
 * provider links rather than instead of them. Nothing here is bespoke
 * cryptography: `@simplewebauthn/server` performs every verification, and this
 * module only says where the ceremony is allowed to happen and remembers what
 * was asked a moment ago.
 */

/**
 * The challenge, held for one ceremony.
 *
 * `__Host-` prefixed: host-only, Secure, and unreadable by scripts. It is the
 * browser that must prove it was asked, so the challenge belongs in that
 * browser and nowhere else — a shared table would let one tab's challenge answer
 * another's.
 *
 * Five minutes is longer than any prompt takes and short enough that an
 * abandoned one is worthless. Single use is enforced by clearing it the moment
 * it is read, whether or not what follows succeeds: a challenge that could be
 * answered twice is a replay waiting to happen.
 */
const COOKIE = '__Host-hk_webauthn';
const TTL_SECONDS = 300;

export type Ceremony = 'register' | 'authenticate';

interface ChallengeState {
  challenge: string;
  ceremony: Ceremony;
  /** Registration is performed by someone already signed in; this is who. */
  userId?: string;
}

export async function rememberChallenge(state: ChallengeState): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify(state), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

/**
 * Read the challenge and destroy it.
 *
 * Cleared before it is parsed, so a malformed one cannot be retried either.
 */
export async function takeChallenge(ceremony: Ceremony): Promise<ChallengeState | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;

  jar.set(COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ChallengeState;
    if (!parsed.challenge) return null;
    // A registration challenge must not answer an authentication, or the other
    // way round: they are asked under different conditions and mean different
    // things.
    if (parsed.ceremony !== ceremony) return null;
    return parsed;
  } catch {
    return null;
  }
}
