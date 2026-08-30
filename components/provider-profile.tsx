import type { ReactNode } from 'react';

/**
 * Whatever a provider said about someone, rendered without knowing the shape.
 *
 * Gravatar returns thirty-odd fields and adds to them over time, so this reads
 * the snapshot rather than a hardcoded list — a field they add next year shows
 * up without a deploy. Known keys get a proper label; anything else falls back
 * to its own name, tidied.
 *
 * Everything here is borrowed and read-only. The account's own name and picture
 * are chosen elsewhere; this is only what the provider holds.
 */

const LABELS: Record<string, string> = {
  display_name: 'Display name',
  first_name: 'First name',
  last_name: 'Last name',
  description: 'About',
  job_title: 'Job title',
  company: 'Company',
  location: 'Location',
  pronouns: 'Pronouns',
  pronunciation: 'Pronunciation',
  timezone: 'Timezone',
  languages: 'Languages',
  links: 'Links',
  interests: 'Interests',
  verified_accounts: 'Verified accounts',
  contact_info: 'Contact',
  payments: 'Payments',
  gallery: 'Gallery',
  profile_url: 'Profile',
  registration_date: 'Registered',
  last_profile_edit: 'Last edited',
  is_organization: 'Organisation',
  number_verified_accounts: 'Verified account count',
};

/**
 * Noise, not detail.
 *
 * Identifiers and rendering hints the person did not write and cannot act on.
 * `hash` is deliberately among them: it is the SHA-256 of their email address,
 * and printing it on screen invites someone to treat it as an address.
 */
const HIDDEN = new Set([
  'user_id',
  'hash',
  'avatar_url',
  'avatar_alt_text',
  'header_image',
  'hide_default_header_image',
  'background_color',
  'section_visibility',
]);

function label(key: string): string {
  return LABELS[key] ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

/** One value, whatever it turned out to be. */
function Value({ value }: { value: unknown }): ReactNode {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (typeof value === 'string') {
    return /^https?:\/\//.test(value) ? (
      <a href={value} target="_blank" rel="noreferrer noopener">
        {value}
      </a>
    ) : (
      value
    );
  }

  if (typeof value === 'number') return String(value);

  if (Array.isArray(value)) {
    return (
      <ul className="provider-profile__list">
        {value.map((item, index) => (
          <li key={index}>
            <Value value={item} />
          </li>
        ))}
      </ul>
    );
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([key, inner]) => !HIDDEN.has(key) && !isEmpty(inner),
    );

    // A record with a name and a link is a link with a name, not a table.
    const record = value as Record<string, unknown>;
    const name = record.label ?? record.name ?? record.service_label;
    const href = record.url ?? record.service_icon;
    if (typeof name === 'string' && typeof href === 'string' && /^https?:\/\//.test(href)) {
      return (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {name}
        </a>
      );
    }

    return (
      <ul className="provider-profile__list">
        {entries.map(([key, inner]) => (
          <li key={key}>
            <span className="provider-profile__sublabel">{label(key)}</span>{' '}
            <Value value={inner} />
          </li>
        ))}
      </ul>
    );
  }

  return null;
}

export function ProviderProfile({
  providerLabel,
  profile,
}: {
  providerLabel: string;
  profile: Record<string, unknown>;
}) {
  const entries = Object.entries(profile).filter(
    ([key, value]) => !HIDDEN.has(key) && !isEmpty(value),
  );

  if (entries.length === 0) return null;

  return (
    <div className="rows">
      {entries.map(([key, value]) => (
        <div className="row" key={key}>
          <span className="row__label">{label(key)}</span>
          <span className="row__value provider-profile__value">
            <Value value={value} />
          </span>
          <span className="row__trailing" />
        </div>
      ))}
      <div className="row">
        <span className="row__label" />
        <span className="row__value">
          <span className="row__note">
            Held by {providerLabel}, and shown as it was when you connected it. Reconnect to
            refresh it, or change it at {providerLabel}.
          </span>
        </span>
        <span className="row__trailing" />
      </div>
    </div>
  );
}
