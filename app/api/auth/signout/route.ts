import { NextResponse } from 'next/server';

import { clearDisplayUser } from '@/lib/auth/ecosystem-cookie';
import { destroySession } from '@/lib/auth/session';

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
  const origin = new URL(request.url).origin;
  await destroySession();
  await clearDisplayUser(new URL(request.url).hostname);
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
