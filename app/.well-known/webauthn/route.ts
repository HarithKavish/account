import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export function GET() {
  return NextResponse.json(
    {
      origins: [
        'https://auth.harithkavish.com',
        'https://account.harithkavish.com',
        'https://harithkavish.com',
      ],
    },
    {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=86400',
      },
    },
  );
}
