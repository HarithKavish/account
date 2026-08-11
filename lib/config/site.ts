/**
 * Structured site content. Everything the shell renders comes from here rather
 * than being scattered through components.
 */

/**
 * The canonical production origin. Overridable per environment (preview
 * deployments, local development) but always falls back to the real domain.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://account.harithkavish.com';

export const site = {
  /** The product is branded simply "Account" beside the HarithKavish mark. */
  name: 'Account',
  fullName: 'HarithKavish Account',
  domain: 'account.harithkavish.com',
  url: SITE_URL,
  parentUrl: 'https://harithkavish.com',
  summary: 'Your HarithKavish Account.',
} as const;

export type CategoryId = 'home' | 'personal-info' | 'privacy' | 'security' | 'preferences';

export interface Category {
  id: CategoryId;
  label: string;
  href: string;
}

/**
 * The left-hand categories of the account app. Order is the display order.
 *
 * `/security` and `/settings` keep their original paths so existing links and
 * bookmarks stay valid, even though they are presented as categories now.
 */
export const categories: Category[] = [
  { id: 'home', label: 'Home', href: '/account' },
  { id: 'personal-info', label: 'Personal info', href: '/personal-info' },
  { id: 'privacy', label: 'Data & privacy', href: '/privacy' },
  { id: 'security', label: 'Security', href: '/security' },
  { id: 'preferences', label: 'Preferences', href: '/settings' },
];
