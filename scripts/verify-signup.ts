/**
 * Verifies the account-creation flow against the REAL database.
 *
 *   npm run verify:signup -- <userId> <password>
 *
 * Pass the user ID and password you just created through the signup form. The
 * script asserts what actually landed in PostgreSQL:
 *
 *   1. The schema is present, including the uniqueness constraint.
 *   2. The account row exists with the expected profile.
 *   3. The stored value is an Argon2id hash, not the password.
 *   4. That hash genuinely verifies against the password.
 *   5. The plaintext appears nowhere in the row.
 *   6. An `account_created` audit event was written.
 *   7. A duplicate user_id is rejected by the database, not just the app.
 *
 * Read-only apart from step 7, which inserts inside a transaction and rolls it
 * back. Nothing is deleted.
 */

import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { verify } from '@node-rs/argon2';

neonConfig.webSocketConstructor = ws;

const [userIdArg, passwordArg] = process.argv.slice(2);

if (!userIdArg || !passwordArg) {
  console.error('Usage: npm run verify:signup -- <userId> <password>');
  process.exit(2);
}

const userId = userIdArg.trim().toLowerCase();
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  process.exit(2);
}

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures += 1;
}

const pool = new Pool({ connectionString: url });

try {
  // 1. Schema -------------------------------------------------------------
  const tables = await pool.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_name in ('users','account_events')`,
  );
  const tableNames = tables.rows.map((r) => r.table_name).sort();
  check('users and account_events exist', tableNames.length === 2, tableNames.join(', '));

  const unique = await pool.query(
    `select indexname from pg_indexes
     where tablename = 'users' and indexname = 'users_user_id_unique'`,
  );
  check('unique index on users.user_id exists', unique.rowCount === 1);

  // 2. The account row ----------------------------------------------------
  const users = await pool.query<{
    id: string;
    user_id: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    status: string;
    created_at: Date;
  }>(
    `select id, user_id, password_hash, first_name, last_name, status, created_at
     from users where user_id = $1`,
    [userId],
  );

  check(`account "${userId}" exists`, users.rowCount === 1, `${users.rowCount} row(s)`);

  if (users.rowCount !== 1) {
    console.error('\nCannot continue without the account row.');
    process.exit(1);
  }

  const user = users.rows[0];
  console.log(
    `\n  id         ${user.id}\n` +
      `  user_id    ${user.user_id}\n` +
      `  name       ${user.first_name} ${user.last_name}\n` +
      `  status     ${user.status}\n` +
      `  created_at ${user.created_at.toISOString()}\n`,
  );

  check(
    'internal id is a UUID, distinct from the login identity',
    /^[0-9a-f-]{36}$/i.test(user.id) && user.id !== user.user_id,
  );
  check('user_id stored lowercase', user.user_id === user.user_id.toLowerCase());
  check('status is active', user.status === 'active');

  // 3–5. Credentials ------------------------------------------------------
  check(
    'password_hash is an Argon2id hash',
    user.password_hash.startsWith('$argon2id$'),
    user.password_hash.slice(0, 30) + '…',
  );
  check('password_hash is not the password', user.password_hash !== passwordArg);
  check(
    'plaintext password appears nowhere in the row',
    !JSON.stringify(user).includes(passwordArg),
  );
  check('stored hash verifies against the password', await verify(user.password_hash, passwordArg));
  check(
    'stored hash rejects a wrong password',
    !(await verify(user.password_hash, passwordArg + 'x')),
  );

  // 6. Audit trail --------------------------------------------------------
  const events = await pool.query<{ type: string; metadata: unknown }>(
    `select type, metadata from account_events where user_id = $1 order by occurred_at`,
    [user.id],
  );
  check(
    'account_created event recorded',
    events.rows.some((e) => e.type === 'account_created'),
    events.rows.map((e) => e.type).join(', ') || 'none',
  );
  check(
    'no credential material in event metadata',
    !JSON.stringify(events.rows).includes(passwordArg) &&
      !JSON.stringify(events.rows).includes(user.password_hash),
  );

  // 7. The database itself enforces uniqueness ----------------------------
  const client = await pool.connect();
  let duplicateRejected = false;
  let duplicateCode = '';
  try {
    await client.query('begin');
    await client.query(
      `insert into users (user_id, password_hash, first_name, last_name)
       values ($1, 'x', 'Dup', 'Licate')`,
      [userId],
    );
    await client.query('rollback');
  } catch (error) {
    duplicateCode = (error as { code?: string }).code ?? '';
    duplicateRejected = duplicateCode === '23505';
    await client.query('rollback').catch(() => {});
  } finally {
    client.release();
  }
  check('duplicate user_id rejected by the database', duplicateRejected, duplicateCode || 'inserted!');

  // Confirm the rollback left nothing behind.
  const after = await pool.query('select count(*)::int as n from users where user_id = $1', [userId]);
  check('still exactly one row after the duplicate attempt', after.rows[0].n === 1);
} finally {
  await pool.end();
}

console.log(`\n=== ${failures ? `FAILURES: ${failures}` : 'ALL CHECKS PASSED'} ===`);
process.exit(failures ? 1 : 0);
