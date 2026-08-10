import type { NextConfig } from 'next';

/**
 * Security headers. Kept here rather than in host configuration so they travel
 * with the app regardless of where it is deployed.
 *
 * Phase 3 note: a Content-Security-Policy belongs here too, but it needs a
 * nonce for the inline theme script, which is best introduced alongside the
 * server-rendered session work rather than bolted on now.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // publickey-credentials-get is left enabled for same-origin WebAuthn in Phase 4.
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
