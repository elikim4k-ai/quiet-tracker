import { NextResponse } from 'next/server';
import { authToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(req) {
  const { password } = await req.json();
  const expected = process.env.TRACKER_PASSWORD;
  if (!expected) return NextResponse.json({ ok: true }); // no gate configured
  if (password !== expected) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await authToken(expected), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
  return res;
}
