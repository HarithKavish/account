import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

import { safeNext } from '@/lib/auth/flow';
import { destinationFor } from '@/lib/auth/handoff';
import { AUTH_HOST, hostOf } from '@/lib/auth/hosts';
import { getSessionUser } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Am I already signed in?", asked by one of our hosts on behalf of a visitor.
 *
 * The account host cannot see the auth host's session — that is the whole point
 * of a `__Host-` cookie — so when it finds no session of its own it sends the
 * visitor here. If a session exists, this mints a one-time ticket and bounces
 * them back with it. If not, they get the sign-in page, and the destination is
 * carried through so they land where they were going.
 *
 * Nothing here is a session check for anyone else: a ticket is issued only for a
 * host we run, and only ever for the account it names.
 */
export async function GET(request: Request) {
  const headerList = await headers();

  // The front door is the only place a session originates, so it is the only
  // place that can vouch for one.
  if (hostOf(headerList.get('host')) !== AUTH_HOST) {
    return NextResponse.redirect(new URL('/', `https://${AUTH_HOST}`));
  }

  const requested = new URL(request.url).searchParams.get('next');
  const destination = safeNext(requested);

  const session = await getSessionUser();
  if (!session) {
    const login = new URL('/', `https://${AUTH_HOST}`);
    login.searchParams.set('next', destination);
    return NextResponse.redirect(login);
  }

  return NextResponse.redirect(
    await destinationFor(destination, AUTH_HOST, session.userId),
  );
}
