/**
 * Environment loading for everything that runs OUTSIDE the Next.js server:
 * drizzle-kit, migrations and the verification scripts.
 *
 * It uses `@next/env` — the very loader Next.js runs at startup — rather than
 * calling dotenv by hand. That matters: Next's precedence is not simply
 * ".env.local then .env". It also considers `.env.development[.local]` and
 * `.env.production[.local]` depending on NODE_ENV. A hand-rolled loader that
 * reads only two of those files will eventually disagree with the application
 * about which database is configured, which is precisely the bug this file
 * exists to make impossible.
 *
 * Using Next's own implementation means the CLI and the app cannot drift,
 * because there is only one implementation.
 *
 * On a deployed host there are no env files at all; `loadEnvConfig` finds none
 * and the values already present in `process.env` are used unchanged.
 */

import { loadEnvConfig } from '@next/env';
import { describeTarget, readDatabaseEnv } from './env';

let loaded = false;
let loadedFiles: string[] = [];

/** Loads env files exactly as Next.js would. Safe to call more than once. */
export function loadEnv(): { files: string[] } {
  if (!loaded) {
    // `dev: false` selects .env.production* over .env.development* when
    // NODE_ENV says so, matching a production build.
    const result = loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
    loadedFiles = (result.loadedEnvFiles ?? []).map((f) => f.path);
    loaded = true;
  }
  return { files: loadedFiles };
}

/**
 * Loads env, validates the database configuration, and returns the DIRECT
 * connection string used by migrations and verification.
 *
 * Every database-touching CLI entry point should go through this, so they all
 * fail the same way and all target the same database.
 */
export function loadDatabaseUrlForCli(): { unpooledUrl: string; target: string; files: string[] } {
  const { files } = loadEnv();
  const db = readDatabaseEnv();
  return {
    unpooledUrl: db.unpooledUrl,
    target: describeTarget(db.unpooledUrl),
    files,
  };
}
