import 'server-only';

import { cookies } from 'next/headers';

/**
 * Carrying freshly issued recovery codes from the callback to the page that
 * shows them.
 *
 * They exist in plaintext exactly once, and only the database's hashes survive
 * afterwards. A cookie is the shortest path between a redirect and the next
 * render; it is host-only, one-shot, and lives for two minutes.
 *
 * They are not put in the URL, where they would land in history and in every
 * proxy log between here and the reader.
 */
const COOKIE = '__Host-hk_recovery';
const TTL_SECONDS = 120;

export async function stashRecoveryCodes(codes: string[]): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify(codes), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

/** Read once and clear, so a refresh cannot show them again. */
export async function takeRecoveryCodes(): Promise<string[] | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  jar.delete(COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}
