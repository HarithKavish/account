import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { getDb, schema } from '@/lib/db/client';
import { userForToken } from '@/lib/oauth/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Who the token belongs to.
 *
 * `sub` is the Account UUID (V12) — stable across every way a person might sign
 * in, and the only identifier a surface should key anything on. A provider's
 * subject never appears here; nor does a credential, a status, or anything a
 * surface has no business deciding from.
 */
export async function GET(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const userId = await userForToken(token);
  if (!userId) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const db = getDb();
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const user = rows[0];

  // Deleted between issuing the token and spending it. V19: it must not
  // authenticate, and a token minted a moment earlier does not change that.
  if (!user || user.status === 'deleted') {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const name = `${user.firstName} ${user.lastName}`.trim();

  return NextResponse.json(
    {
      sub: user.id,
      name,
      preferred_username: user.userId ?? null,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
