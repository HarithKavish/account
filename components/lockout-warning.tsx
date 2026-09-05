import Link from 'next/link';

/**
 * The one thing an account made through a provider is missing.
 *
 * Such an account has exactly one way in, and the ecosystem does not control it.
 * If that provider account is lost — closed, locked, an address that stopped
 * being theirs — so is this one. Recovery codes cover it, but a user ID and
 * password are the way back most people will actually reach for.
 *
 * Shown until it is no longer true rather than once at sign-up: a notice someone
 * dismissed while getting to what they came for has told them nothing.
 */
export function LockoutWarning({
  needsUserId,
  needsPassword,
}: {
  needsUserId: boolean;
  needsPassword: boolean;
}) {
  if (!needsUserId && !needsPassword) return null;

  const missing =
    needsUserId && needsPassword
      ? 'a user ID and a password'
      : needsUserId
        ? 'a user ID'
        : 'a password';

  return (
    <div className="notice" role="note">
      <p className="notice__title">Add {missing} so you can always get in</p>
      <p className="notice__body">
        This account signs in through a connected service and nothing else. If you ever lose access
        to it, {missing} is what gets you back.
      </p>
      <p className="notice__actions">
        <Link className="button button--primary button--slim" href="/security">
          Set {missing}
        </Link>
      </p>
    </div>
  );
}
