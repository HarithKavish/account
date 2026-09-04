import 'server-only';

import { readGravatarEnv } from '@/lib/env';
import type { FlowSecrets } from './google';

/**
 * Gravatar as a profile source — connect-only.
 *
 * Deliberately not a way to sign in. It is connected by someone who is already
 * signed in, and it lends the account a picture and whatever they have written
 * on their Gravatar profile. It can never create an account, so it cannot become
 * a third way to end up holding two.
 *
 * The flow runs against WordPress.com, which issues Gravatar's tokens, and the
 * profile is read from Gravatar's own API with the result.
 *
 * Authorization Code with a server-side secret (V13) and exact redirect matching
 * (V14). Gravatar's server-side tokens do not expire, which is precisely why
 * this module reads the profile once and throws the token away rather than
 * keeping a credential that never dies (V26).
 */

/**
 * The issuer this provider is recorded under.
 *
 * Gravatar rather than WordPress.com: WordPress.com is the machinery that issues
 * the token, but what the person connected — and what they will look for in a
 * list — is their Gravatar.
 */
export const GRAVATAR_ISSUER = 'https://gravatar.com';

const AUTHORIZE = 'https://public-api.wordpress.com/oauth2/authorize';
const TOKEN = 'https://public-api.wordpress.com/oauth2/token';
const PROFILE = 'https://api.gravatar.com/v3/me/profile';

/**
 * `auth` to authenticate at all, and read access to the profile. `:manage` is
 * not asked for: nothing here edits anyone's Gravatar, and a scope granted is a
 * scope that has to be justified later.
 *
 * Sent as an indexed array — `scope[0]=…&scope[1]=…` — because that is what
 * this provider documents. The space-separated form the rest of the OAuth world
 * uses is not what it reads.
 */
const SCOPES = ['auth', 'gravatar-profile:read'];

export function authorizeUrl(secrets: FlowSecrets, redirectUri: string): string {
  const url = new URL(AUTHORIZE);
  url.searchParams.set('client_id', readGravatarEnv().clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  SCOPES.forEach((scope, index) => url.searchParams.set(`scope[${index}]`, scope));
  url.searchParams.set('state', secrets.state);
  return url.toString();
}

/** The snapshot taken at connect time. Shape follows Gravatar's own profile. */
export interface GravatarProfile {
  user_id?: number | string;
  hash?: string;
  display_name?: string;
  avatar_url?: string;
  [key: string]: unknown;
}

export interface GravatarIdentity {
  issuer: string;
  /** Gravatar's `user_id` — stable, and unlike `hash` it survives an email change. */
  subject: string;
  displayName: string | null;
  avatarUrl: string | null;
  profile: GravatarProfile;
}

/**
 * Exchange the code and read the profile.
 *
 * The access token lives inside this function and nowhere else: it is used for
 * exactly one request and never returned, stored or logged.
 */
/**
 * Why a connection failed, in the server log and nowhere else.
 *
 * The person gets one message because the difference is not theirs to act on;
 * whoever has to fix it needs the stage and the upstream status. Codes, tokens
 * and the client secret are never logged — an OAuth error body carries only
 * `error` and `error_description`, which is exactly the part worth having.
 */
function note(stage: string, detail: unknown): void {
  console.error(`[gravatar] ${stage}:`, detail);
}

export async function completeFlow(
  code: string,
  redirectUri: string,
): Promise<GravatarIdentity | null> {
  const env = readGravatarEnv();

  const tokenResponse = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code,
    }),
  });

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text().catch(() => '');
    note('token exchange rejected', {
      status: tokenResponse.status,
      body: body.slice(0, 400),
      /*
       * Enough to tell which credential is in play without printing it. A
       * WordPress.com client id is a short run of digits; a Gravatar API key is
       * a long alphanumeric string, and confusing the two is the likeliest
       * reason this endpoint says it has never heard of the client.
       */
      clientId: {
        length: env.clientId.length,
        numeric: /^\d+$/.test(env.clientId),
      },
      secretLength: env.clientSecret.length,
      redirectUri,
    });
    return null;
  }

  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) {
    note('token exchange returned no access_token', { status: tokenResponse.status });
    return null;
  }

  const profileResponse = await fetch(PROFILE, {
    headers: { authorization: `Bearer ${token.access_token}`, accept: 'application/json' },
    cache: 'no-store',
  });

  if (!profileResponse.ok) {
    const body = await profileResponse.text().catch(() => '');
    note('profile request rejected', { status: profileResponse.status, body: body.slice(0, 400) });
    return null;
  }

  const profile = (await profileResponse.json()) as GravatarProfile;

  /*
   * `user_id` is the only identifier worth keying on, and it is returned only to
   * an authenticated request. `hash` is the SHA-256 of the primary email
   * address, so it changes the day someone changes that address — which would
   * silently turn one connection into a different one.
   */
  const subject = profile.user_id != null ? String(profile.user_id) : '';
  if (!subject) {
    // Returned only to an authenticated request, so its absence means the token
    // was not accepted as one — usually a scope that was not granted.
    note('profile carried no user_id', { keys: Object.keys(profile).slice(0, 40) });
    return null;
  }

  return {
    issuer: GRAVATAR_ISSUER,
    subject,
    displayName: typeof profile.display_name === 'string' ? profile.display_name : null,
    avatarUrl: typeof profile.avatar_url === 'string' ? profile.avatar_url : null,
    profile,
  };
}
