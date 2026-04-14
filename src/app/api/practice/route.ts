import { NextRequest, NextResponse } from 'next/server';
import { getPracticeResponse } from '@/lib/gemini';
import { chatLimiter } from '@/lib/rate-limiter';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { allowed, retryAfterMs } = chatLimiter.check(ip, 30, 60 * 1000);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  try {
    const { transcript } = await req.json();

    if (!Array.isArray(transcript)) {
      return NextResponse.json({ error: 'Invalid transcript' }, { status: 400 });
    }

    const response = await getPracticeResponse(transcript);

    return NextResponse.json({ text: response.text });
  } catch (err) {
    console.error('[practice-api] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
