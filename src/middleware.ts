import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { extractClientIp } from './lib/utils';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-zeus-client-ip', extractClientIp(request.headers));

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
