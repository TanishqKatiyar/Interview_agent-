import { NextResponse } from 'next/server';
import { createInterview } from '@/lib/supabase';
import { sendInvitationEmail } from '@/lib/email';
import { inviteLimiter } from '@/lib/rate-limiter';
import { sanitizeName, sanitizeEmail } from '@/lib/sanitize';

// ─── POST /api/interviews/invite ────────────────────────────────────────────
// Admin auth has been removed for the Cuemath showcase. The endpoint is still
// rate-limited by client IP to keep abuse under control.

function clientKey(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'anonymous'
  );
}

export async function POST(request: Request) {
  const { allowed, retryAfterMs } = inviteLimiter.check(clientKey(request), 20, 3600 * 1000);

  if (!allowed) {
    return Response.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  try {
    const body = await request.json();

    const name = sanitizeName(body.candidate_name);
    const email = sanitizeEmail(body.candidate_email);
    const sendEmail = body.send_email !== false; // default true — skip by passing false

    if (!name) return Response.json({ error: 'Invalid name' }, { status: 400 });
    if (!email) return Response.json({ error: 'Invalid email' }, { status: 400 });

    const interview = await createInterview(name, email);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const interviewUrl = `${baseUrl}/interview/${interview.interview_token}`;

    let emailSent = false;
    if (sendEmail) {
      emailSent = await sendInvitationEmail(email, name, interviewUrl);
    }

    return NextResponse.json({
      success: true,
      interview_id: interview.id,
      interview_token: interview.interview_token,
      interview_url: interviewUrl,
      email_sent: emailSent,
    });
  } catch (err) {
    console.error('Invite API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
