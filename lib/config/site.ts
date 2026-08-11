/**
 * Structured site content.
 *
 * This is the Account Platform. Authentication belongs to a separate product at
 * auth.harithkavish.com and is referenced here only as an external service.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://account.harithkavish.com';

export const site = {
  /** The product is branded simply "Account" beside the HarithKavish mark. */
  name: 'Account',
  fullName: 'HarithKavish Account',
  domain: 'account.harithkavish.com',
  url: SITE_URL,
  parentUrl: 'https://harithkavish.com',
  summary: 'Create and manage your HarithKavish Account.',
} as const;

/**
 * The Authentication Platform. Treated strictly as an external service: this
 * app links to it and describes it, and implements none of its behaviour.
 */
export const authPlatform = {
  name: 'HarithKavish Authentication',
  domain: 'auth.harithkavish.com',
  url: 'https://auth.harithkavish.com',
} as const;

export type CategoryId = 'overview' | 'profile' | 'security' | 'delete';

export interface Category {
  id: CategoryId;
  label: string;
  href: string;
}

/** Account management categories. */
export const categories: Category[] = [
  { id: 'overview', label: 'Overview', href: '/account' },
  { id: 'profile', label: 'Profile', href: '/settings' },
  { id: 'security', label: 'Security', href: '/security' },
  { id: 'delete', label: 'Delete account', href: '/delete' },
];
