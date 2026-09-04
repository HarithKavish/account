import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

import { clientSecret, findClient, redirectAllowed } from '@/lib/oauth/clients';
import { consumeCode, issueToken, pruneExpired } from '@/lib/oauth/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/** `Basic base64(client_id:client_secret)`, per RFC 6749 §2.3.1. */
function readBasicAuth(header: string | null): { id: string; secret: string } | null {
  if (!header || !header.toLowerCase().startsWith('basic ')) return null;
  try {
    const decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 0) return null;
    return {
      // The spec form-encodes each half before joining them.
      id: decodeURIComponent(decoded.slice(0, separator)),
      secret: decodeURIComponent(decoded.slice(separator + 1)),
    };
  } catch {
    return null;
  }
}

function secretMatches(expected: string, presented: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(presented);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Exchange a code for an access token. Server to server only.
 *
 * The client proves itself with its secret, and proves the code is the one it
 * started by presenting the PKCE verifier. Either alone is not enough: the
 * secret says which surface is asking, the verifier says this is the same
 * browser round trip that began it.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return bad('invalid_request');

  /*
   * A client may authenticate either way.
   *
   * RFC 6749 puts the credentials in an Authorization header and calls the body
   * form optional, so most libraries reach for Basic first — Auth.js does. A
   * server that reads only the body rejects them with `invalid_client` and
   * leaves the client author staring at a correct-looking configuration.
   */
  const basic = readBasicAuth(request.headers.get('authorization'));
  const clientId = basic?.id ?? String(form.get('client_id') ?? '');

  const client = findClient(clientId);
  if (!client) return bad('invalid_client', 401);

  const expected = clientSecret(client);
  const presented = basic?.secret ?? String(form.get('client_secret') ?? '');
  if (!expected || !presented || !secretMatches(expected, presented)) {
    return bad('invalid_client', 401);
  }

  if (String(form.get('grant_type') ?? '') !== 'authorization_code') {
    return bad('unsupported_grant_type');
  }

  const redirectUri = String(form.get('redirect_uri') ?? '');
  if (!redirectAllowed(client, redirectUri)) return bad('invalid_grant');

  const result = await consumeCode({
    code: String(form.get('code') ?? ''),
    clientId: client.id,
    redirectUri,
    codeVerifier: String(form.get('code_verifier') ?? ''),
  });

  // One answer for every reason a code is not usable — expired, already spent,
  // wrong client, wrong redirect, wrong verifier. Which of those it was is not
  // the caller's business, and saying would help someone probing.
  if (!result) return bad('invalid_grant');

  const { token, expiresInSeconds } = await issueToken(client.id, result.userId);

  // Cheap, and keeps spent codes from accumulating forever.
  void pruneExpired().catch(() => {});

  return NextResponse.json(
    { access_token: token, token_type: 'Bearer', expires_in: expiresInSeconds },
    { headers: { 'cache-control': 'no-store' } },
  );
}
