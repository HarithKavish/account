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
  name: 'HarithKavish Account',
  shortName: 'Account',
  descriptor: 'One account for HarithKavish',
  domain: 'account.harithkavish.com',
  url: SITE_URL,
  parentUrl: 'https://harithkavish.com',
  summary:
    'One HarithKavish Account for signing in to HarithKavish products. Built around identity and authentication, nothing more.',
} as const;

export interface NavItem {
  label: string;
  href: string;
}

/** Primary navigation for a signed-in user. */
export const accountNav: NavItem[] = [
  { label: 'Account', href: '/account' },
  { label: 'Security', href: '/security' },
  { label: 'Settings', href: '/settings' },
];

/** Navigation shown before sign-in. */
export const publicNav: NavItem[] = [
  { label: 'Sign in', href: '/login' },
  { label: 'Create account', href: '/signup' },
];

export const footerNav: NavItem[] = [
  { label: 'Sign in', href: '/login' },
  { label: 'Create account', href: '/signup' },
  { label: 'HarithKavish', href: site.parentUrl },
];

/**
 * The products a HarithKavish Account is intended to unlock. Phase 7 work —
 * listed here as roadmap, never rendered as if the connection already exists.
 */
export interface EcosystemProduct {
  name: string;
  description: string;
  /** 'available' would mean sign-in actually works today. None do yet. */
  status: 'planned';
}

export const ecosystem: EcosystemProduct[] = [
  {
    name: 'Forge',
    description: 'Project resource intelligence.',
    status: 'planned',
  },
  {
    name: 'Nexus',
    description: 'Connected workspace services.',
    status: 'planned',
  },
  {
    name: 'VR',
    description: 'Immersive experiences.',
    status: 'planned',
  },
];
