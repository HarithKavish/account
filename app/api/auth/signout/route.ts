import { NextResponse } from 'next/server';

import { clearDisplayUser } from '@/lib/auth/ecosystem-cookie';
import { destroySession } from '@/lib/auth/session';
import { safeNext } from '@/lib/auth/flow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sign out.
 *
 * POST only: a GET would let any page sign someone out with an image tag.
 *
 * Both cookies go. Clearing only the session would leave every other surface
 * showing a face for a browser that no longer has one.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);

  await destroySession();
  await clearDisplayUser(url.hostname);

  // Back where they were. Same allow-list as signing in — a sign-out link is
  // just as good a place to hide a redirect somewhere else.
  const form = await request.formData().catch(() => null);
  const next = safeNext(form ? String(form.get('next') ?? '') || null : null);

  return NextResponse.redirect(new URL(next, url.origin), { status: 303 });
}
