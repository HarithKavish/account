/**
 * Reports the schema of a database, for comparing environments.
 *
 *   npm run db:schema              # the database .env.local points at
 *   npm run db:schema -- <url>     # an explicit connection string
 *
 * Prints structure only — never rows, never credentials.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { inspectTarget } from '../lib/env';
import { loadDatabaseUrlForCli } from '../lib/env-cli';

neonConfig.webSocketConstructor = ws;

const explicit = process.argv[2];
const url = explicit ?? loadDatabaseUrlForCli().unpooledUrl;
const target = inspectTarget(url);

console.log(`host      ${target.host}`);
console.log(`database  ${target.database}`);
console.log(`user      ${target.user}\n`);

const pool = new Pool({ connectionString: url });

try {
  const tables = await pool.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' order by 1`,
  );
  console.log('tables:  ' + tables.rows.map((r) => r.table_name).join(', '));

  const enums = await pool.query<{ typname: string; values: string }>(
    `select t.typname, string_agg(e.enumlabel, '|' order by e.enumsortorder) as values
     from pg_type t join pg_enum e on e.enumtypid = t.oid
     join pg_namespace n on n.oid = t.typnamespace and n.nspname = 'public'
     group by t.typname order by 1`,
  );
  console.log('\nenums:');
  for (const e of enums.rows) console.log(`  ${e.typname} = ${e.values}`);

  const indexes = await pool.query<{ tablename: string; indexname: string; indexdef: string }>(
    `select tablename, indexname, indexdef from pg_indexes
     where schemaname = 'public' order by tablename, indexname`,
  );
  console.log('\nindexes:');
  for (const i of indexes.rows) {
    console.log(`  ${i.indexname}${i.indexdef.includes('UNIQUE') ? '  [UNIQUE]' : ''}`);
  }

  const constraints = await pool.query<{ table_name: string; constraint_name: string; constraint_type: string }>(
    `select tc.table_name, tc.constraint_name, tc.constraint_type
     from information_schema.table_constraints tc
     where tc.table_schema = 'public' and tc.constraint_type in ('PRIMARY KEY','FOREIGN KEY','UNIQUE')
     order by 1, 3, 2`,
  );
  console.log('\nconstraints:');
  for (const c of constraints.rows) {
    console.log(`  ${c.table_name}: ${c.constraint_type} ${c.constraint_name}`);
  }

  const migrations = await pool.query<{ hash: string; created_at: string }>(
    `select hash, created_at from drizzle.__drizzle_migrations order by created_at`,
  );
  console.log(`\nmigrations applied: ${migrations.rowCount}`);

  // Row counts only — no data is read.
  const users = await pool.query('select count(*)::int n from users');
  const events = await pool.query('select count(*)::int n from account_events');
  console.log(`\nrow counts: users=${users.rows[0].n}  account_events=${events.rows[0].n}`);
} finally {
  await pool.end();
}
