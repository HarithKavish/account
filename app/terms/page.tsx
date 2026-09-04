import type { Metadata } from 'next';

import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The terms for using a HarithKavish Account.',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="30 August 2026">
      <p>
        These terms cover the HarithKavish Account service at account.harithkavish.com and
        auth.harithkavish.com — creating an account, signing in, and managing it. Individual services
        that use your account may add terms of their own.
      </p>

      <h2>The account</h2>
      <p>
        A HarithKavish Account is free and personal to you. One person, one account. You are
        responsible for what is done with it, so keep your password and recovery codes to yourself —
        anyone holding them can sign in as you.
      </p>
      <p>
        You may connect a provider such as Google as another way to sign in. A provider account can
        be connected to only one HarithKavish Account at a time.
      </p>

      <h2>What is expected of you</h2>
      <ul>
        <li>Give a name you are willing to be identified by. Do not impersonate anyone.</li>
        <li>Do not attempt to reach an account that is not yours, or to disrupt the service.</li>
        <li>Do not automate account creation.</li>
      </ul>

      <h2>Ending it</h2>
      <p>
        You can delete your account at any time from the account site. Deletion is immediate and
        permanent, and your user ID is released for anyone to take. Nothing is recoverable
        afterwards, so export anything you need from the services that use your account first.
      </p>
      <p>
        An account may be suspended or removed if it is used to attack the service or another
        person&rsquo;s account.
      </p>

      <h2>What this service promises</h2>
      <p>
        Honestly: not much. This is a personal project offered as it is, without warranty and without
        a guarantee of availability, and it may change or stop. It is not sold, and nothing here
        creates a paid relationship. To the extent the law allows, there is no liability for loss
        arising from its use — including loss of access to a service that relies on it.
      </p>
      <p>
        What it does promise is that your account is handled as described in the{' '}
        <a href="/privacy">privacy page</a>, and that deleting it means deleting it.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may change. The date at the top says when they last did. Continuing to use the
        account after a change means accepting it.
      </p>

      <h2>Contact</h2>
      <p>
        <span className="mono">harithkavish40@gmail.com</span>
      </p>
    </LegalPage>
  );
}
