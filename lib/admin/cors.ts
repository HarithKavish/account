import 'server-only';

import { NextResponse } from 'next/server';

/**
 * The dashboard is a static site on another origin, so it has to be let in
 * deliberately.
 *
 * `admin.harithkavish.com` is a GitHub Pages site: it holds no session and can
 * hold none (`lib/auth/hosts.ts` — the adopt allow-list exists to keep it that
 * way). It reads this API from the browser instead, carrying the visitor's own
 * session cookie, and that only works if this origin says so by name.
 *
 * An exact list, never a `*.harithkavish.com` test. `sites.harithkavish.com`
 * publishes other people's pages, so "any subdomain" is "any author who signs
 * up" — and with `Allow-Credentials` set, a wildcard is not even legal.
 */
const ORIGINS: readonly string[] = ['https://admin.harithkavish.com'];

/** Serving the dashboard from a local file server while working on it. */
const DEV_ORIGINS: readonly string[] = [
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

function allowed(origin: string | null): string | null {
  if (!origin) return null;
  if (ORIGINS.includes(origin)) return origin;
  if (process.env.NODE_ENV !== 'production' && DEV_ORIGINS.includes(origin)) return origin;
  return null;
}

/**
 * The headers that let a named origin read the answer.
 *
 * `Vary: Origin` is set whether or not the origin was allowed. Without it a
 * cache can hand one origin's response — allowed or refused — to another.
 */
export function corsHeaders(request: Request): Headers {
  const headers = new Headers({ vary: 'Origin' });
  const origin = allowed(request.headers.get('origin'));
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
  }
  return headers;
}

/**
 * Answer a preflight.
 *
 * `GET` only. Every route here reads; nothing under `/api/admin` writes, which
 * is also why a same-site request arriving without a CSRF token is harmless —
 * there is no state for it to change. Adding a write to this API means adding a
 * token check with it.
 */
export function preflight(request: Request): NextResponse {
  const headers = corsHeaders(request);
  headers.set('access-control-allow-methods', 'GET, OPTIONS');
  headers.set('access-control-allow-headers', 'content-type');
  headers.set('access-control-max-age', '600');
  return new NextResponse(null, { status: 204, headers });
}

/**
 * A JSON answer that no cache may keep.
 *
 * These responses describe accounts and who is signed in. `no-store` rather than
 * `no-cache`: the difference is whether a copy is written down at all.
 */
export function json(request: Request, body: unknown, status: number): NextResponse {
  const headers = corsHeaders(request);
  headers.set('cache-control', 'no-store');
  return NextResponse.json(body, { status, headers });
}
