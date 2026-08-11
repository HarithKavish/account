import { defineConfig } from 'drizzle-kit';
import { loadDatabaseUrlForCli } from './lib/env-cli';

/**
 * Migrations run against the DIRECT (unpooled) connection. Pooled connections
 * go through PgBouncer in transaction mode, which cannot execute the
 * session-level statements DDL migrations rely on.
 *
 * Env loading and validation are shared with every other database-touching
 * entry point (see lib/env-cli.ts), so drizzle-kit and the application can
 * never resolve to different databases.
 */
const { unpooledUrl, target, files } = loadDatabaseUrlForCli();

console.log(`[drizzle] env files: ${files.length ? files.join(', ') : '(none — using process.env)'}`);
console.log(`[drizzle] target:    ${target}`);

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: unpooledUrl },
  strict: true,
  verbose: true,
});
