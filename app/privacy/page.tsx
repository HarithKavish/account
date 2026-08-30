import type { Metadata } from 'next';

import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What a HarithKavish Account stores, and what it does not.',
  // Unlike the rest of this service, these two pages are meant to be found.
  robots: { index: true, follow: true },
};

/**
 * Written from the schema rather than from a template.
 *
 * Every claim below is checkable against `lib/db/schema.ts` and the modules that
 * write to it. A privacy policy that describes something other than what the
 * code does is worse than none: it is a statement of intent that nobody can
 * verify and that drifts silently.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="30 August 2026">
      <p>
        A HarithKavish Account is the identity used across harithkavish.com and its services. This
        page describes what that account stores. It covers the account itself — not what any
        individual service does once it knows who you are.
      </p>

      <h2>What is stored</h2>
      <p>Your account holds only what it needs to be your account:</p>
      <ul>
        <li>
          <strong>Your name</strong>, as you entered it, and <strong>your user ID</strong> if you
          chose one. An account created through a provider has no user ID unless you pick one.
        </li>
        <li>
          <strong>A password hash</strong>, if you set a password — Argon2id, never the password
          itself. An account that signs in only through a provider stores no password at all.
        </li>
        <li>
          <strong>Recovery codes</strong>, stored hashed. Each works once.
        </li>
        <li>
          <strong>Sessions</strong>: a SHA-256 hash of the session token, when it was created, last
          seen and expires, and the browser&rsquo;s user-agent string truncated to 200 characters so
          you can recognise your own sessions. The token itself is never stored.
        </li>
        <li>
          <strong>An account history</strong> — that an account was created, a profile updated, a
          password changed, a provider connected. Timestamps and event types, with no copy of what
          changed.
        </li>
      </ul>

      <h2>If you connect a provider</h2>
      <p>
        Connecting a provider such as Google adds another way to reach your account. It does not
        hand your account to them, and your HarithKavish account remains the identity.
      </p>
      <p>From a connected provider we store:</p>
      <ul>
        <li>
          <strong>The provider&rsquo;s subject identifier</strong> — an opaque string identifying you
          to that provider. This is what the connection is keyed on.
        </li>
        <li>
          <strong>The email address it asserted</strong>, if it was verified, and{' '}
          <strong>the picture URL it asserted</strong>. Both are for display and for recognising
          which of your provider accounts is connected.
        </li>
      </ul>
      <p>
        The email address is deliberately <em>not</em> used to find accounts. Matching accounts by
        email address is how a verified address becomes a way to take one over, so it is stored and
        shown, and never looked up.
      </p>
      <p>
        We request only the provider&rsquo;s identity scopes — with Google, that is{' '}
        <span className="mono">openid email profile</span>. No other scope is asked for, because no
        other data is wanted. <strong>Access and refresh tokens are never stored</strong>: the
        provider&rsquo;s answer is verified once, at sign-in, and discarded. Nothing here can act on
        your behalf at a provider, then or later.
      </p>
      <p>
        A provider&rsquo;s picture is shown only if you choose it. The default is a placeholder, and
        you can return to it at any time.
      </p>

      <h2>What is not stored</h2>
      <ul>
        <li>Your password, in any recoverable form.</li>
        <li>Provider access tokens, refresh tokens or ID tokens.</li>
        <li>Advertising or analytics identifiers. There are no third-party trackers on this site.</li>
        <li>An email address for password-based accounts. None is asked for.</li>
      </ul>

      <h2>Cookies</h2>
      <p>Only cookies the service cannot work without:</p>
      <ul>
        <li>
          <span className="mono">__Host-hk_session</span> — your session. Host-only, Secure, and not
          readable by scripts.
        </li>
        <li>
          <span className="mono">__Host-hk_oauth</span> — the ten-minute state of a sign-in in
          progress with a provider.
        </li>
        <li>
          <span className="mono">hk.user</span> — your display name and picture, readable across
          harithkavish.com subdomains so each site can show you as signed in. It carries{' '}
          <strong>no authority</strong>: no service treats it as permission to do anything.
        </li>
      </ul>

      <h2>Your IP address</h2>
      <p>
        Sign-in and sign-up attempts are rate-limited to five per ten minutes. Your IP address is
        used as the bucket key for that limit and is <strong>never written to the database</strong>.
        Our hosting provider keeps its own request logs, as any web host does.
      </p>

      <h2>Who else is involved</h2>
      <ul>
        <li><strong>Vercel</strong> — hosting.</li>
        <li><strong>Neon</strong> — the database.</li>
        <li><strong>Upstash</strong> — the rate-limit counter.</li>
        <li>
          <strong>Google</strong> — only if you choose to sign in with or connect it.
        </li>
      </ul>
      <p>Your account is not sold, rented or shared with anyone else.</p>

      <h2>Deleting your account</h2>
      <p>
        Deletion is immediate and permanent. The account row is deleted outright rather than marked
        deleted, and your sessions, provider connections and recovery codes go with it. Your user ID
        is released and someone else may take it.
      </p>
      <p>
        The account history is kept, with its link to you removed — so the record that something
        happened survives, while nothing identifying you does. It carries no copy of your name or
        user ID.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this account service: <span className="mono">harithkavish40@gmail.com</span>.
      </p>
    </LegalPage>
  );
}
