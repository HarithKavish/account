/**
 * What a passkey is called before anyone names it.
 *
 * Separate from the store because it depends on nothing: no database, no
 * request, no secrets. That makes the rule assertable on its own, which matters
 * because the rule is a judgement — what WebAuthn genuinely reports versus what
 * would merely be a plausible guess.
 */

/** The name a credential gets when its owner has not chosen one. */
export function defaultDisplayName(transports: string[], deviceType: string | null): string {
  // WebAuthn does not report what device made a credential. What it does report
  // is how the authenticator can be reached, which is enough to say something
  // true and no more. A name guessed from a user-agent string is wrong often
  // enough to be worse than none.
  if (transports.includes('usb') || transports.includes('nfc')) return 'Security key';
  if (transports.includes('hybrid')) return 'Passkey on another device';
  if (deviceType === 'multiDevice') return 'Synced passkey';
  return 'Passkey on this device';
}

