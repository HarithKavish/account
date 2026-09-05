/**
 * Apply pending migrations as part of a production deploy.
 *
 * The database credential is stored as a Sensitive environment variable, which
 * means it is available to a build and to the running application but cannot be
 * read back out — deliberately. So migrations run where the credential already
 * is, rather than being copied somewhere it can be read.
 *
 * Safe to run on every deploy: drizzle records what it has applied in
 * `__drizzle_migrations` and does nothing when there is nothing to do.
 *
 * It runs BEFORE the build, so a migration that fails takes the deploy with it
 * rather than publishing code whose tables do not exist.
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const env = process.env.VERCEL_ENV;

// Opt-in, not opt-out: only a real Vercel production deploy runs this. A
// preview deploy shares the one database, so migrating from a branch would
// apply someone's half-finished schema to production -- but the same is true,
// for a different reason, of anywhere that isn't Vercel at all. CI's own
// `npm run build` (ci.yml) runs this exact script with no VERCEL_ENV set, and
// is explicitly meant to need no live credential; `env && env !== 'production'`
// treated "VERCEL_ENV unset" as if it meant production, which is exactly
// backwards, and sent CI reaching for a DATABASE_URL_UNPOOLED it was never
// going to have.
if (env !== 'production') {
  console.log(`[migrate] VERCEL_ENV=${env ?? '(unset)'} — skipping, production only.`);
  process.exit(0);
}

// The direct connection: migrations issue statements a transaction-mode pooler
// cannot carry.
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.error('[migrate] DATABASE_URL_UNPOOLED is not set.');
  process.exit(1);
}

const target = (() => {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}/${parsed.pathname.replace(/^\//, '')}`;
  } catch {
    return '(unparseable)';
  }
})();

console.log(`[migrate] target: ${target}`);

const pool = new Pool({ connectionString: url });

try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  console.log('[migrate] up to date.');
} catch (error) {
  console.error('[migrate] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await pool.end();
}
