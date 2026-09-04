import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { safeNext } from '@/lib/auth/flow';
import { consumeHandoffTicket } from '@/lib/auth/handoff';
import { AUTH_HOST, hostOf, isAdoptHost } from '@/lib/auth/hosts';
import { attemptCookie } from '@/lib/auth/require';
import { createSession } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Redeem a ticket from the auth host for a session on this one.
 *
 * The ticket names the host allowed to spend it, and this compares that against
 * the host the request actually arrived on — so a ticket minted for the account
 * host is worthless anywhere else, including here if this ever runs somewhere
 * new.
 *
 * A failed redemption is not an error page. The ticket may simply have been
 * spent already — a refresh does that — so the visitor is sent back to the front
 * door, which will either wave them straight through or ask them to sign in.
 */
export async function GET(request: Request) {
  const headerList = await headers();
  const host = hostOf(headerList.get('host'));

  const params = new URL(request.url).searchParams;
  const destination = safeNext(params.get('next'));

  if (!isAdoptHost(host)) {
    return NextResponse.redirect(new URL('/', `https://${AUTH_HOST}`));
  }

  const userId = await consumeHandoffTicket(params.get('ticket') ?? '', host);
  if (!userId) {
    const login = new URL('/', `https://${AUTH_HOST}`);
    login.searchParams.set('next', destination);
    return NextResponse.redirect(login);
  }

  await createSession(userId, headerList.get('user-agent'));

  const response = NextResponse.redirect(destination);
  response.cookies.set(attemptCookie());
  return response;
}
