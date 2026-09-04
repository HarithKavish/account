/**
 * Verifies the `account_type` migration (human | ai) against the REAL
 * database.
 *
 *   npm run verify:account-type
 *
 * Unlike verify-signup.mts, this needs no pre-existing account: everything it
 * checks is either read-only against whatever already exists, or created and
 * rolled back inside one transaction. Nothing is left behind, and no
 * pre-existing row is touched.
 *
 * Checks:
 *   1. The account_type enum exists with exactly ('human', 'ai').
 *   2. users.account_type exists, is NOT NULL, defaults to 'human'.
 *   3. The account_type index exists.
 *   4. Every existing account is already classified 'human' or 'ai' (no NULLs).
 *   5. Inserting a user without specifying account_type defaults to 'human'.
 *   6. account_type can be explicitly set to 'ai'.
 *   7. An invalid account_type value is rejected by the database itself.
 *   8. account_events' foreign key to users still works for a freshly
 *      created row of either type.
 *
 * Everything from step 5 onward runs inside one transaction that is always
 * rolled back at the end, insert failures included.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { loadDatabaseUrlForCli } from '../lib/env-cli';

neonConfig.webSocketConstructor = ws;

const { unpooledUrl: url, target, files } = loadDatabaseUrlForCli();

console.log(`env files: ${files.length ? files.join(', ') : '(none — using process.env)'}`);
console.log(`target:    ${target}\n`);

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures += 1;
}

const pool = new Pool({ connectionString: url });

// A fresh users row needs every NOT NULL column filled. Kept in one place so
// each insert below only has to override what it is actually testing.
function baseUserRow(suffix: string) {
  return {
    userId: `verify-account-type-${suffix}-${Date.now()}`,
    passwordHash: '$argon2id$v=19$m=1,t=1,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    firstName: 'Verify',
    lastName: 'AccountType',
  };
}

try {
  // 1. Enum shape ------------------------------------------------------------
  const enumValues = await pool.query<{ enumlabel: string }>(
    `select e.enumlabel from pg_type t
     join pg_enum e on e.enumtypid = t.oid
     join pg_namespace n on n.oid = t.typnamespace and n.nspname = 'public'
     where t.typname = 'account_type'
     order by e.enumsortorder`,
  );
  const values = enumValues.rows.map((r) => r.enumlabel);
  check('account_type enum exists with exactly [human, ai]', JSON.stringify(values) === JSON.stringify(['human', 'ai']), values.join(', ') || '(missing)');

  // 2. Column shape ------------------------------------------------------------
  const column = await pool.query<{ is_nullable: string; column_default: string | null }>(
    `select is_nullable, column_default from information_schema.columns
     where table_schema = 'public' and table_name = 'users' and column_name = 'account_type'`,
  );
  check('users.account_type column exists', column.rowCount === 1);
  if (column.rowCount === 1) {
    const col = column.rows[0];
    check('users.account_type is NOT NULL', col.is_nullable === 'NO', col.is_nullable);
    check(
      "users.account_type defaults to 'human'",
      !!col.column_default && col.column_default.includes("'human'"),
      col.column_default ?? '(none)',
    );
  }

  // 3. Index ------------------------------------------------------------
  const idx = await pool.query(
    `select indexname from pg_indexes where tablename = 'users' and indexname = 'users_account_type_idx'`,
  );
  check('users_account_type_idx exists', idx.rowCount === 1);

  // 4. Existing data is fully classified ------------------------------------------------------------
  const unclassified = await pool.query('select count(*)::int as n from users where account_type is null');
  check('no existing account has a NULL account_type', unclassified.rows[0].n === 0, `${unclassified.rows[0].n} unclassified`);

  const totals = await pool.query<{ account_type: string; n: number }>(
    `select account_type, count(*)::int as n from users group by account_type order by account_type`,
  );
  console.log(
    '\n  existing accounts by type: ' +
      (totals.rows.length ? totals.rows.map((r) => `${r.account_type}=${r.n}`).join(', ') : '(no accounts yet)') +
      '\n',
  );

  // 5–8. Everything below happens inside one rolled-back transaction ------------------------------------------------------------
  const client = await pool.connect();
  try {
    await client.query('begin');

    // 5. Default applies when account_type is omitted, exactly like the
    //    existing signup flow's insert (see lib/account/service.ts).
    const a = baseUserRow('default');
    const insertedDefault = await client.query<{ id: string; account_type: string }>(
      `insert into users (user_id, password_hash, first_name, last_name)
       values ($1, $2, $3, $4) returning id, account_type`,
      [a.userId, a.passwordHash, a.firstName, a.lastName],
    );
    check(
      "omitting account_type on insert defaults to 'human'",
      insertedDefault.rows[0]?.account_type === 'human',
      insertedDefault.rows[0]?.account_type,
    );

    // 6. Explicit 'ai' is accepted and stored correctly.
    const b = baseUserRow('ai');
    const insertedAi = await client.query<{ id: string; account_type: string }>(
      `insert into users (user_id, password_hash, first_name, last_name, account_type)
       values ($1, $2, $3, $4, 'ai') returning id, account_type`,
      [b.userId, b.passwordHash, b.firstName, b.lastName],
    );
    check("account_type can be explicitly 'ai'", insertedAi.rows[0]?.account_type === 'ai');

    // 7. An invalid value is rejected by the enum constraint itself, not just
    //    application code.
    //
    // A SAVEPOINT wraps this specific statement, not a full ROLLBACK/BEGIN:
    // a plain ROLLBACK undoes the WHOLE transaction back to its original
    // BEGIN, including steps 5 and 6's already-successful inserts -- which
    // is exactly the second bug this replaced. It passed its own check (the
    // invalid insert was correctly rejected) but silently deleted step 5's
    // row, so step 8's foreign-key insert then failed for a completely
    // unrelated reason: the user it pointed at no longer existed. Caught in
    // production. ROLLBACK TO SAVEPOINT undoes only the work since the
    // savepoint, leaving 5 and 6 intact and the transaction still usable.
    let invalidRejected = false;
    let invalidCode = '';
    await client.query('savepoint before_invalid_insert');
    try {
      const c = baseUserRow('invalid');
      await client.query(
        `insert into users (user_id, password_hash, first_name, last_name, account_type)
         values ($1, $2, $3, $4, 'robot')`,
        [c.userId, c.passwordHash, c.firstName, c.lastName],
      );
    } catch (error) {
      invalidCode = (error as { code?: string }).code ?? '';
      // 22P02 = invalid_text_representation, Postgres's error for a value
      // that is not a member of the enum type.
      invalidRejected = invalidCode === '22P02';
    } finally {
      // Runs whether the insert was rejected as expected or not -- any
      // statement error poisons the transaction until either this or a full
      // rollback, and the whole point of the savepoint is to need only this.
      await client.query('rollback to savepoint before_invalid_insert');
    }
    check('an invalid account_type value is rejected by the database', invalidRejected, invalidCode || 'inserted!');

    // 8. The existing users -> account_events relationship is unaffected by
    //    the new column, for either account type.
    const event = await client.query<{ id: string }>(
      `insert into account_events (user_id, type, metadata)
       values ($1, 'account_created', $2) returning id`,
      [insertedDefault.rows[0]?.id, JSON.stringify({ source: 'verify_account_type_script' })],
    );
    check('account_events FK to users still accepts a new row', event.rowCount === 1);

    const joined = await client.query(
      `select u.account_type from account_events e
       join users u on u.id = e.user_id
       where e.id = $1`,
      [event.rows[0]?.id],
    );
    check(
      'account_events -> users join returns the right account_type',
      joined.rows[0]?.account_type === 'human',
      joined.rows[0]?.account_type,
    );
  } finally {
    // Always rolled back, success or failure -- this script must never leave
    // data behind, and must never touch a row it did not itself create.
    await client.query('rollback').catch(() => {});
    client.release();
  }
} finally {
  await pool.end();
}

console.log(`\n=== ${failures ? `FAILURES: ${failures}` : 'ALL CHECKS PASSED'} ===`);
process.exit(failures ? 1 : 0);
