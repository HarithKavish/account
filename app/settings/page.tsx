'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/components/auth-provider';
import { Field, FormAlert, SubmitButton } from '@/components/form';
import { RequireAuth } from '@/components/route-guard';
import { ThemeToggle } from '@/components/theme-toggle';
import { hasErrors, validateProfile, type FieldErrors } from '@/lib/account/validation';
import type { AccountUser } from '@/lib/account/types';

function ProfileSettings({ user }: { user: AccountUser }) {
  const { updateProfile } = useAuth();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const dirty = firstName !== user.firstName || lastName !== user.lastName;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSaved(false);

    const input = { firstName, lastName };
    const errors = validateProfile(input);
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setPending(true);
    const result = await updateProfile(input);
    setPending(false);

    if (result.ok) {
      setSaved(true);
      return;
    }

    if (result.error.field) {
      setFieldErrors({ [result.error.field]: result.error.message });
    } else {
      setFormError(result.error.message);
    }
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">Profile</h2>
      </div>
      <p className="panel__body">
        Your name is how HarithKavish products address you. Your user ID cannot be changed.
      </p>

      {formError && <FormAlert>{formError}</FormAlert>}
      {saved && <FormAlert tone="success">Profile updated.</FormAlert>}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="form__row">
          <Field
            label="First name"
            name="firstName"
            value={firstName}
            onChange={setFirstName}
            autoComplete="given-name"
            error={fieldErrors.firstName}
            disabled={pending}
          />
          <Field
            label="Last name"
            name="lastName"
            value={lastName}
            onChange={setLastName}
            autoComplete="family-name"
            error={fieldErrors.lastName}
            disabled={pending}
          />
        </div>

        <Field
          label="User ID"
          name="userId"
          value={user.userId}
          onChange={() => {}}
          hint="Your sign-in identity. Fixed for now."
          disabled
          required={false}
        />

        <div className="form__actions">
          <SubmitButton pending={pending} pendingLabel="Saving…" disabled={!dirty}>
            Save changes
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}

function SettingsContent({ user }: { user: AccountUser }) {
  const { signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <>
      <section className="page-head">
        <p className="page-head__eyebrow">Settings</p>
        <h1 className="page-head__title">Settings</h1>
        <p className="page-head__lead">Your profile, how you sign in, and how this site looks.</p>
      </section>

      <div className="stack">
        {/* Keyed on the account so the form re-initialises if the signed-in
            user changes, without mirroring props into state. */}
        <ProfileSettings key={user.id} user={user} />

        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Security</h2>
          </div>
          <p className="panel__body">
            Password, passkeys and active sessions are managed on the Security page.
          </p>
          <div>
            <Link className="button button--secondary" href="/security">
              Go to Security
            </Link>
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Preferences</h2>
          </div>
          <p className="panel__body">
            Appearance follows your system setting until you choose otherwise. Your choice is
            remembered on this device.
          </p>
          <div>
            <ThemeToggle />
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Session</h2>
          </div>
          <p className="panel__body">Sign out of your HarithKavish Account on this device.</p>
          <div>
            <button type="button" className="button button--danger" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <AppShell>
      <RequireAuth>{user && <SettingsContent user={user} />}</RequireAuth>
    </AppShell>
  );
}
