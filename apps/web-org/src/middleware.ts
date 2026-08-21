import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (
    pathname === '/login' ||
    pathname === '/accept-invite' ||
    pathname.startsWith('/proxy/api/') ||
    pathname.startsWith('/v1/auth/')
  ) {
    return NextResponse.next();
  }

  if (!request.cookies.has('d2d_at')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
