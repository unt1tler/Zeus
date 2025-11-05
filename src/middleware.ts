import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get('session');

  const requestHeaders = new Headers(request.headers);
  const ip = request.ip ?? '127.0.0.1';
  requestHeaders.set('x-forwarded-for', ip);

  const isApiRoute = pathname.startsWith('/api');
  const isClientRoute = pathname.startsWith('/client') || pathname === '/login';
  const isAdminLogin = pathname === '/admin/login';
  const isPublicAsset = pathname.includes('.') && !pathname.startsWith('/_next');

  if (isApiRoute || isClientRoute || isAdminLogin || isPublicAsset) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!session || session.value !== process.env.SESSION_SECRET) {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
