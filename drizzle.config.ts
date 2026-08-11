import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Migrations run against the DIRECT (unpooled) Neon connection. Pooled
 * connections go through PgBouncer in transaction mode, which cannot execute
 * the session-level statements DDL migrations rely on.
 */
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    'Set DATABASE_URL_UNPOOLED (preferred) or DATABASE_URL before running drizzle-kit. See .env.example.',
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
