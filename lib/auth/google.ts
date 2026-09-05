import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { readGoogleEnv } from '@/lib/env';
import type { VerifiedProviderIdentity } from '@/lib/account/types';

/**
 * Google as an upstream identity provider — contract §7.6.
 *
 * This half runs the flow and verifies what comes back. The account half is
 * given a subject it can trust and owns everything that follows. Google is a way
 * to prove a HarithKavish account, never an account itself (V24).
 *
 * Authorization Code with PKCE (V13), exact redirect matching (V14), and a nonce
 * bound into the ID token. The code is exchanged server-side, so the client
 * secret never reaches a browser and neither does any Google token.
 */

export const GOOGLE_ISSUER = 'https://accounts.google.com';
const AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';

/** Fetched and cached by `jose`; rotated keys are picked up without a deploy. */
const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export interface FlowSecrets {
  state: string;
  nonce: string;
  codeVerifier: string;
}

export function beginFlow(): FlowSecrets {
  return {
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    codeVerifier: randomBytes(64).toString('base64url'),
  };
}

function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function authorizeUrl(secrets: FlowSecrets, redirectUri: string): string {
  const url = new URL(AUTHORIZE);
  url.searchParams.set('client_id', readGoogleEnv().clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  // Identity only. No Google API is called with this, so no other scope is asked
  // for — a scope granted is a scope that has to be justified later.
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', secrets.state);
  url.searchParams.set('nonce', secrets.nonce);
  url.searchParams.set('code_challenge', challengeFor(secrets.codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');
  // Let someone choose which Google account, rather than silently reusing
  // whichever the browser happens to be signed into.
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

/**
 * Exchange the code and verify the ID token.
 *
 * Verified here rather than trusted: signature against Google's keys, issuer,
 * audience, expiry, and the nonce this flow issued. The account half performs no
 * provider validation and does not have to — it trusts this function, the way
 * §5.10 has Account trust Auth rather than the token.
 */
export async function completeFlow(
  code: string,
  secrets: FlowSecrets,
  redirectUri: string,
): Promise<VerifiedProviderIdentity | null> {
  const env = readGoogleEnv();

  const response = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.clientId,
      client_secret: env.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: secrets.codeVerifier,
    }),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as { id_token?: string };
  if (!payload.id_token) return null;

  try {
    const { payload: claims } = await jwtVerify(payload.id_token, jwks, {
      issuer: [GOOGLE_ISSUER, 'accounts.google.com'],
      audience: env.clientId,
    });

    // Without this, an ID token minted for another session of the same client
    // would be accepted here.
    if (claims.nonce !== secrets.nonce) return null;
    if (typeof claims.sub !== 'string' || !claims.sub) return null;

    return {
      issuer: GOOGLE_ISSUER,
      subject: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : null,
      emailVerified: claims.email_verified === true,
      name: typeof claims.name === 'string' ? claims.name : null,
      // Present with the `profile` scope. Kept as the provider's current answer
      // rather than as anything permanent: these URLs expire.
      picture: typeof claims.picture === 'string' ? claims.picture : null,
    };
  } catch {
    // Any verification failure is the same answer: this did not authenticate.
    return null;
  }
  // Google's access and refresh tokens are deliberately not returned, not
  // stored, and not logged (V26). Nothing here needs to call Google again.
}
