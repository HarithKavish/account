import type { NextConfig } from 'next';

/**
 * The Account Platform is a server application: account creation writes to
 * PostgreSQL through a Server Action. It can no longer be exported as a static
 * site, so the previous STATIC_EXPORT mode and the GitHub Pages deployment are
 * gone.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
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

  // Argon2 is a native module and must not be bundled into the server output.
  serverExternalPackages: ['@node-rs/argon2'],

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
