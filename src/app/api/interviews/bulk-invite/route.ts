import { NextResponse } from 'next/server';
import { createInterview } from '@/lib/supabase';
import { sendInvitationEmail } from '@/lib/email';
import { bulkInviteLimiter } from '@/lib/rate-limiter';
import { sanitizeName, sanitizeEmail } from '@/lib/sanitize';

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clientKey(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'anonymous'
  );
}

// ─── POST /api/interviews/bulk-invite ───────────────────────────────────────
// Admin auth removed for the showcase; IP-scoped rate limit remains.

interface CandidateInput {
  name: string;
  email: string;
}

interface CandidateResult {
  name: string;
  email: string;
  success: boolean;
  interview_url?: string;
  error?: string;
}

export async function POST(request: Request) {
  const { allowed, retryAfterMs } = bulkInviteLimiter.check(clientKey(request), 3, 3600 * 1000);
  
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    const { candidates, send_email = true } = body as {
      candidates?: CandidateInput[];
      send_email?: boolean;
    };

    // ── Validate ──
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json(
        { error: 'No candidates provided.' },
        { status: 400 },
      );
    }

    if (candidates.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 candidates per batch.' },
        { status: 400 },
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const results: CandidateResult[] = [];
    let sentCount = 0;
    let failedCount = 0;

    // ── Process each candidate sequentially ──
    for (let i = 0; i < candidates.length; i++) {
      const rawName = candidates[i].name;
      const rawEmail = candidates[i].email;
      
      const name = sanitizeName(rawName);
      const email = sanitizeEmail(rawEmail);

      // Validate individual row
      if (!name) {
        // use rawName/rawEmail for error reporting if sanitized is empty
        results.push({ name: rawName || '', email: rawEmail || '', success: false, error: 'Name missing or invalid' });
        failedCount++;
        continue;
      }

      if (!email) {
        results.push({ name: rawName || '', email: rawEmail || '', success: false, error: 'Invalid email' });
        failedCount++;
        continue;
      }

      try {
        // Create interview in Supabase
        const interview = await createInterview(name.trim(), email.trim());
        const interviewUrl = `${baseUrl}/interview/${interview.interview_token}`;

        // Send email (if requested)
        let emailSent = false;
        if (send_email) {
          emailSent = await sendInvitationEmail(
            email.trim(),
            name.trim(),
            interviewUrl,
          );
        }

        results.push({
          name: name.trim(),
          email: email.trim(),
          success: true,
          interview_url: interviewUrl,
        });
        sentCount++;

        // Log for visibility
        console.log(
          `[${i + 1}/${candidates.length}] Created invite for ${name} (${email})` +
            (send_email ? ` — email ${emailSent ? 'sent' : 'skipped'}` : ''),
        );

        // Rate-limit delay (skip on last iteration)
        if (send_email && i < candidates.length - 1) {
          await sleep(500);
        }
      } catch (err) {
        console.error(`Failed to invite ${name} (${email}):`, err);
        results.push({
          name,
          email,
          success: false,
          error: (err as Error).message || 'Unknown error',
        });
        failedCount++;
      }
    }

    return NextResponse.json({
      total: candidates.length,
      sent: sentCount,
      failed: failedCount,
      results,
    });
  } catch (err) {
    console.error('Bulk invite API error:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Internal server error' },
      { status: 500 },
    );
  }
}
