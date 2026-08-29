import 'server-only';

/**
 * The surfaces allowed to ask who is signed in.
 *
 * A short list in code rather than a table. There is one first-party client
 * today, and a registry that can be edited at runtime is a way to grant access
 * without review — which for the thing that hands out identity is the wrong
 * default. A new client is a deploy.
 *
 * Redirect URIs are matched exactly (V14): no prefixes, no wildcards, https
 * only. A prefix match is how `https://forge.harithkavish.com.attacker.test`
 * ends up receiving somebody's authorization code.
 */
export interface OAuthClient {
  id: string;
  name: string;
  redirectUris: readonly string[];
  /** Env var holding the shared secret for the token exchange. */
  secretEnv: string;
}

const CLIENTS: readonly OAuthClient[] = [
  {
    id: 'forge',
    name: 'Forge',
    redirectUris: [
      // Auth.js derives this from the provider id, so it is fixed by that name.
      'https://forge.harithkavish.com/api/auth/callback/harithkavish',
      'http://localhost:3000/api/auth/callback/harithkavish',
    ],
    secretEnv: 'OAUTH_SECRET_FORGE',
  },
];

export function findClient(clientId: string | null): OAuthClient | null {
  if (!clientId) return null;
  return CLIENTS.find((c) => c.id === clientId) ?? null;
}

export function redirectAllowed(client: OAuthClient, redirectUri: string | null): boolean {
  if (!redirectUri) return false;
  return client.redirectUris.includes(redirectUri);
}

/**
 * The client's secret, or null when it is not configured.
 *
 * Returning null rather than throwing lets the token endpoint answer with a
 * plain refusal: a misconfigured deployment should look like a client that
 * cannot authenticate, not like a server that fell over.
 */
export function clientSecret(client: OAuthClient): string | null {
  const value = process.env[client.secretEnv];
  return value && value.trim() ? value : null;
}
