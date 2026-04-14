import { NextResponse } from 'next/server';
import { getInterviewerResponse } from '@/lib/gemini';
import { chatLimiter } from '@/lib/rate-limiter';
import type { TranscriptEntry } from '@/lib/types';

// ─── POST /api/interviews/respond ───────────────────────────────────────────

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { allowed, retryAfterMs } = chatLimiter.check(ip, 30, 60 * 1000);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const { system_prompt, transcript } = body as {
      system_prompt?: string;
      transcript?: TranscriptEntry[];
    };

    if (!system_prompt || !transcript) {
      return NextResponse.json(
        { error: 'system_prompt and transcript are required.' },
        { status: 400 },
      );
    }

    const response = await getInterviewerResponse(system_prompt, transcript);

    return NextResponse.json({ response });
  } catch (err) {
    console.error('[respond] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
