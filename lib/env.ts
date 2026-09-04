/**
 * The single definition of this project's environment contract.
 *
 * This module does NOT load env files — it only reads and validates what is
 * already in `process.env`. Loading is the caller's job and differs by context:
 *
 *   - The Next.js app:  Next loads env files itself before any code runs.
 *   - CLI tooling:      `lib/env-cli.ts` loads them using Next's own loader.
 *
 * Keeping the *contract* here and the *loading* in one shared place is what
 * stops the application and the migration CLI from ever disagreeing about which
 * database they are talking to.
 *
 * Deliberately free of `server-only`, because CLI scripts import it too.
 */

export interface DatabaseEnv {
  /** Pooled connection — used by the running application. */
  url: string;
  /** Direct connection — used by migrations and verification. */
  unpooledUrl: string;
}

export interface UpstashEnv {
  url: string;
  token: string;
}

/**
 * Google as an upstream identity provider (contract §7.6).
 *
 * The secret is read here and used only in a server-to-server token exchange.
 * It must never reach a browser, and no Google token is stored anywhere (V26).
 */
/**
 * Gravatar as a profile source (contract §7.6, connect-only).
 *
 * Registered at gravatar.com/developers; the flow itself runs against
 * WordPress.com, which is what issues Gravatar's tokens. The secret must never
 * reach a browser, and the token is discarded the moment the profile is read.
 */
export interface GravatarEnv {
  clientId: string;
  clientSecret: string;
}

export interface GoogleEnv {
  clientId: string;
  clientSecret: string;
}

class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new EnvError(
      `${name} is not set.\n` +
        'Copy .env.example to .env.local and fill it in, or set it in your ' +
        'hosting provider for a deployed environment.',
    );
  }
  /*
   * Quotes are stripped, not just whitespace.
   *
   * A dashboard's copy button and a paste into a web form both like to bring
   * quotation marks along, and a credential wrapped in them is a different
   * string — one the provider has never heard of. The failure that produces is
   * indistinguishable from a wrong credential, so it is worth not having.
   */
  return value.trim().replace(/^["'](.*)["']$/, '$1').trim();
}

/**
 * Neon exposes the pooled connection on a `-pooler` host and the direct
 * connection on the same host without it. Normalising lets the two be compared
 * for equality of *target* rather than of string.
 */
function normalizeHost(hostname: string): string {
  return hostname.replace('-pooler', '');
}

/** Host and database only. Never includes credentials — safe to print. */
export function describeTarget(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const database = url.pathname.replace(/^\//, '') || '(default)';
    return `${normalizeHost(url.hostname)}/${database}`;
  } catch {
    return '(unparseable connection string)';
  }
}

/**
 * Structured, credential-free breakdown of a connection target, for reporting.
 * The password is never read, let alone returned.
 */
export function inspectTarget(connectionString: string): {
  host: string;
  database: string;
  user: string;
  pooled: boolean;
} {
  const url = new URL(connectionString);
  return {
    host: normalizeHost(url.hostname),
    database: url.pathname.replace(/^\//, '') || '(default)',
    user: url.username || '(none)',
    pooled: url.hostname.includes('-pooler'),
  };
}

/**
 * Guards the failure this project is most exposed to: the application reads the
 * pooled URL while migrations use the direct one, so if the two ever point at
 * different databases, migrations land somewhere the app never reads — and
 * nothing would otherwise complain.
 */
export function assertSameDatabase(pooled: string, unpooled: string): void {
  let a: URL;
  let b: URL;
  try {
    a = new URL(pooled);
    b = new URL(unpooled);
  } catch {
    throw new EnvError(
      'DATABASE_URL and DATABASE_URL_UNPOOLED must both be valid connection strings.',
    );
  }

  const mismatches: string[] = [];
  if (normalizeHost(a.hostname) !== normalizeHost(b.hostname)) {
    mismatches.push(`host: ${normalizeHost(a.hostname)} vs ${normalizeHost(b.hostname)}`);
  }
  if (a.pathname !== b.pathname) {
    mismatches.push(`database: ${a.pathname.slice(1)} vs ${b.pathname.slice(1)}`);
  }
  if (a.username !== b.username) {
    mismatches.push(`user: ${a.username} vs ${b.username}`);
  }

  if (mismatches.length > 0) {
    throw new EnvError(
      'DATABASE_URL and DATABASE_URL_UNPOOLED point at different targets:\n' +
        mismatches.map((m) => `  - ${m}`).join('\n') +
        '\n\nThey must be the pooled and direct connections to the SAME database.' +
        '\nOtherwise migrations apply to one database while the app reads another.',
    );
  }
}

/**
 * Reads and validates the database configuration.
 *
 * Both URLs are required. There is deliberately no fallback from one to the
 * other: silently running migrations through the pooler is exactly the kind of
 * confusing behaviour this module exists to prevent (PgBouncer in transaction
 * mode also cannot execute the session-level statements DDL needs).
 */
export function readDatabaseEnv(): DatabaseEnv {
  const url = required('DATABASE_URL');
  const unpooledUrl = required('DATABASE_URL_UNPOOLED');
  assertSameDatabase(url, unpooledUrl);
  return { url, unpooledUrl };
}

export function readUpstashEnv(): UpstashEnv {
  return {
    url: required('UPSTASH_REDIS_REST_URL'),
    token: required('UPSTASH_REDIS_REST_TOKEN'),
  };
}

export function readGravatarEnv(): GravatarEnv {
  return {
    clientId: required('GRAVATAR_CLIENT_ID'),
    clientSecret: required('GRAVATAR_CLIENT_SECRET'),
  };
}

/** True when both Gravatar variables are present. Never throws. */
export function hasGravatarEnv(): boolean {
  return Boolean(
    process.env.GRAVATAR_CLIENT_ID?.trim() && process.env.GRAVATAR_CLIENT_SECRET?.trim(),
  );
}

export function readGoogleEnv(): GoogleEnv {
  return {
    clientId: required('GOOGLE_CLIENT_ID'),
    clientSecret: required('GOOGLE_CLIENT_SECRET'),
  };
}

/** True when both Google variables are present. Never throws. */
export function hasGoogleEnv(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

/** True when both Upstash variables are present. Never throws. */
export function hasUpstashEnv(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}
