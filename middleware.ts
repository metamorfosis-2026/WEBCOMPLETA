import { NextResponse, type NextRequest } from 'next/server';

import { updateSession } from '@/app/lib/supabase/middleware';

const PROTECTED_MATCHERS = ['/dashboard', '/admin'];

export default async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const isProtected = PROTECTED_MATCHERS.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (!isProtected) return response;

  const hasSessionCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'));

  if (hasSessionCookie) return response;

  const url = new URL('/login', request.nextUrl.origin);
  url.searchParams.set('from', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
