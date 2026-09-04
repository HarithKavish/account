/**
 * Verifies the passkey rules this codebase is responsible for.
 *
 *   npm run verify:passkeys
 *
 * WebAuthn's cryptography is `@simplewebauthn/server`'s job and is not re-tested
 * here — reimplementing its assertions would only test the reimplementation. What
 * this checks is the part written locally, which is where a mistake would
 * actually be ours:
 *
 *   1. The Relying Party ID is the apex domain, so one passkey works on both
 *      hosts.
 *   2. Origin validation is an explicit list — no wildcard, no pattern.
 *   3. Both application hosts are accepted, and nothing else is.
 *   4. A development origin is additive, opt-in, and absent by default.
 *   5. Credential names describe what WebAuthn actually reports, and never guess
 *      a device.
 *
 * The ceremonies themselves are exercised end-to-end against a real browser with
 * a virtual authenticator; see the passkey section of the README notes.
 *
 * Pure: touches no database and no network.
 */

import { RP_ID, RP_NAME, allowedOrigins } from '../lib/auth/webauthn-config';
import { defaultDisplayName } from '../lib/account/passkeys-naming';

let failures = 0;

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${name}`, detail ?? '');
  }
}

console.log('\nRelying Party');
check('RP ID is the apex domain, not a host', RP_ID === 'harithkavish.com', RP_ID);
check('RP name is set', RP_NAME.length > 0);

console.log('\nOrigins');
{
  delete process.env.WEBAUTHN_DEV_ORIGIN;
  const origins = allowedOrigins();

  check('auth host is accepted', origins.includes('https://auth.harithkavish.com'));
  check('account host is accepted', origins.includes('https://account.harithkavish.com'));
  check('exactly those two by default', origins.length === 2, origins);
  check(
    'no wildcard or pattern anywhere',
    origins.every((origin) => !origin.includes('*')),
    origins,
  );
  check(
    'every origin is https',
    origins.every((origin) => origin.startsWith('https://')),
    origins,
  );
  check(
    'a plausible attacker origin is not accepted',
    !origins.includes('https://harithkavish.com.attacker.test'),
  );
}

console.log('\nDevelopment origin');
{
  process.env.WEBAUTHN_DEV_ORIGIN = 'http://localhost:3000';
  const origins = allowedOrigins();

  check('dev origin is added when asked for', origins.includes('http://localhost:3000'));
  check('production origins are still present', origins.length === 3, origins);

  delete process.env.WEBAUTHN_DEV_ORIGIN;
  check('and gone again when not', !allowedOrigins().includes('http://localhost:3000'));
}

console.log('\nCredential naming');
{
  check('usb reads as a security key', defaultDisplayName(['usb'], null) === 'Security key');
  check('nfc reads as a security key', defaultDisplayName(['nfc'], null) === 'Security key');
  check(
    'hybrid reads as another device',
    defaultDisplayName(['hybrid'], 'multiDevice') === 'Passkey on another device',
  );
  check(
    'a synced credential says so',
    defaultDisplayName(['internal'], 'multiDevice') === 'Synced passkey',
  );
  check(
    'anything else stays neutral',
    defaultDisplayName([], null) === 'Passkey on this device',
  );
  check(
    'no name claims to know a device model',
    ![['usb'], ['nfc'], ['hybrid'], ['internal'], []]
      .map((transports) => defaultDisplayName(transports, null))
      .some((name) => /iphone|android|windows|mac|pixel|samsung/i.test(name)),
  );
}

console.log('');
if (failures > 0) {
  console.error(`${failures} check(s) failed.\n`);
  process.exit(1);
}
console.log('All passkey configuration checks passed.\n');
