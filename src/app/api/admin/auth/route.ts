import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { createSession } from '@/lib/auth';
import { authLimiter } from '@/lib/rate-limiter';
import { logInfo, logWarn } from '@/lib/logger';

function verifyPassword(input: string, correct: string): boolean {
  if (input.length !== correct.length) return false;
  return timingSafeEqual(Buffer.from(input), Buffer.from(correct));
}

export async function POST(request: Request) {
  try {
    // RATE LIMITING
    // 5 attempts per 15 minutes per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const { allowed, retryAfterMs } = authLimiter.check(ip, 5, 15 * 60 * 1000);
    
    if (!allowed) {
      logWarn('auth', 'Login rate limited', { ip: ip || 'unknown' });
      return NextResponse.json(
        { error: 'Too many login attempts. Try again in 15 minutes.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      );
    }

    const { password } = await request.json();
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'cuemath-admin-2026'; // fallback for dev

    if (verifyPassword(password || '', adminPassword)) {
      const token = createSession();
      const cookieStore = await cookies();
      
      cookieStore.set('admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60, 
        path: '/',
      });

      logInfo('auth', 'Admin login success', { ip: ip || 'unknown' });
      return NextResponse.json({ success: true });
    }

    logWarn('auth', 'Failed admin login attempt', { ip: ip || 'unknown' });
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
