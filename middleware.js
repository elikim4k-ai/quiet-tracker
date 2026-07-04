import { NextResponse } from 'next/server';
import { authToken, COOKIE_NAME } from '@/lib/auth';

// Gate everything behind a shared password when TRACKER_PASSWORD is set.
// Cron endpoints authenticate themselves with CRON_SECRET instead.
export async function middleware(req) {
  const password = process.env.TRACKER_PASSWORD;
  if (!password) return NextResponse.next(); // no password configured (local dev) — open

  const { pathname } = req.nextUrl;
  if (pathname === '/login' || pathname === '/api/login' || pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie && cookie === (await authToken(password))) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
