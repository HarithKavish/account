/**
 * Reports the resolved environment: which env files were loaded, and which
 * database and Redis instance they point at.
 *
 *   npm run env:check
 *
 * Use it before migrating or deploying to confirm the tooling is aimed where
 * you think it is. Prints hosts and database names only — never credentials.
 */

import { hasUpstashEnv, inspectTarget, readDatabaseEnv } from '../lib/env';
import { loadEnv } from '../lib/env-cli';

const { files } = loadEnv();

console.log('Environment files loaded (highest precedence first):');
if (files.length === 0) {
  console.log('  (none — values come from process.env, as on a deployed host)');
} else {
  for (const file of files) console.log(`  ${file}`);
}

let failed = false;

console.log('\nDatabase:');
try {
  const db = readDatabaseEnv();
  const pooled = inspectTarget(db.url);
  const direct = inspectTarget(db.unpooledUrl);

  console.log(`  host      ${pooled.host}`);
  console.log(`  database  ${pooled.database}`);
  console.log(`  user      ${pooled.user}`);
  console.log(`  pooled    ${db.url.includes('-pooler') ? 'yes' : 'NO — expected a -pooler host for the app'}`);
  console.log(`  direct    ${direct.pooled ? 'NO — direct URL points at the pooler' : 'yes'}`);
  console.log('  ✓ pooled and direct URLs address the same database');
} catch (error) {
  failed = true;
  console.log(`  ✗ ${(error as Error).message.split('\n').join('\n    ')}`);
}

console.log('\nRate limiting (Upstash):');
if (hasUpstashEnv()) {
  const host = new URL(process.env.UPSTASH_REDIS_REST_URL!).hostname;
  console.log(`  ✓ configured — ${host}`);
} else {
  // Not fatal for tooling, but account creation refuses to run without it.
  console.log('  ✗ not configured — account creation will fail closed');
  failed = true;
}

console.log(`\nNEXT_PUBLIC_SITE_URL: ${process.env.NEXT_PUBLIC_SITE_URL ?? '(unset — falls back to production domain)'}`);

console.log(`\n=== ${failed ? 'ENVIRONMENT INCOMPLETE' : 'ENVIRONMENT OK'} ===`);
process.exit(failed ? 1 : 0);
