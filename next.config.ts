import type { NextConfig } from 'next';

/**
 * Two build modes.
 *
 * - Default: a normal Next.js server build. This is the mode Phase 3 needs, as
 *   real authentication requires server routes, sessions and a database.
 * - STATIC_EXPORT=1: a fully static export for GitHub Pages, which is how
 *   account.harithkavish.com is served during Phase 1.
 *
 * Keeping both real means moving to a server host later is a flag, not a
 * rewrite.
 */
const isStaticExport = process.env.STATIC_EXPORT === '1';

/**
 * Security headers for the server build.
 *
 * IMPORTANT: GitHub Pages cannot set custom response headers, so none of these
 * apply to the static deployment — notably X-Frame-Options, which means no
 * clickjacking protection there. That is acceptable while the site holds no
 * real credentials and no session cookie exists to protect, and it is a further
 * reason the platform moves to a server host before Phase 3.
 *
 * A Content-Security-Policy belongs here too, but it needs a nonce for the
 * inline theme script, which is best introduced alongside server rendering.
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

  ...(isStaticExport
    ? {
        output: 'export' as const,
        // Emits every route as <route>/index.html, which is the shape GitHub
        // Pages resolves most reliably for deep links typed directly.
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        async headers() {
          return [{ source: '/:path*', headers: securityHeaders }];
        },
      }),
};

export default nextConfig;
