import 'server-only';

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { headers } from 'next/headers';
import { hasUpstashEnv } from '../env';

/**
 * Rate limiting for account creation.
 *
 * Backed by Upstash Redis so the counter is shared across every serverless
 * instance. An in-process counter would appear to work and silently stop
 * limiting the moment the app scales past one instance.
 *
 * If Upstash is not configured the limiter reports itself as unavailable and
 * account creation is refused rather than proceeding unprotected — an identity
 * system should fail closed.
 */

const WINDOW = '10 m';
const MAX_ATTEMPTS = 5;

let limiter: Ratelimit | null = null;

export function isRateLimitConfigured(): boolean {
  return hasUpstashEnv();
}

function getLimiter(): Ratelimit | null {
  if (!isRateLimitConfigured()) return null;
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(MAX_ATTEMPTS, WINDOW),
      prefix: 'account:signup',
      analytics: false,
    });
  }
  return limiter;
}

/**
 * Best-effort client identity for limiting. Behind Vercel the leftmost
 * x-forwarded-for entry is the real client; the value is only ever used as a
 * bucket key and is never stored.
 */
async function clientKey(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headerList.get('x-real-ip') ?? 'unknown';
}

export type RateLimitOutcome =
  | { allowed: true }
  | { allowed: false; reason: 'limited'; retryAfterSeconds: number }
  | { allowed: false; reason: 'unavailable' };

export async function checkSignupRateLimit(): Promise<RateLimitOutcome> {
  const active = getLimiter();
  if (!active) return { allowed: false, reason: 'unavailable' };

  const key = await clientKey();
  const result = await active.limit(key);

  if (result.success) return { allowed: true };

  return {
    allowed: false,
    reason: 'limited',
    retryAfterSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
  };
}
