// ============================================================================
// POST /api/interviews/finalize
//
// Save the latest transcript + metadata for an interview and, if the
// transcript is long enough, kick off assessment. Designed to be called via
// `navigator.sendBeacon` when the candidate closes the tab early so we never
// lose their answers.
//
// Payload: { interview_id, transcript, metadata, duration_seconds }
// ============================================================================

import { NextResponse } from 'next/server';
import { getInterviewById, updateInterview } from '@/lib/supabase';
import type { TranscriptEntry, InterviewMetadata } from '@/lib/types';
import { logInfo, logError } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    // sendBeacon sets Content-Type to the Blob's type; Next still parses JSON
    // through request.json() as long as the body is valid JSON, but we fall
    // back to text() + JSON.parse() to be safe across browsers.
    let body: {
      interview_id?: string;
      transcript?: TranscriptEntry[];
      metadata?: InterviewMetadata;
      duration_seconds?: number;
    };
    try {
      body = await request.json();
    } catch {
      const raw = await request.text();
      try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
    }

    const { interview_id, transcript, metadata, duration_seconds } = body;

    if (!interview_id || typeof interview_id !== 'string') {
      return NextResponse.json({ error: 'Missing interview_id' }, { status: 400 });
    }

    const interview = await getInterviewById(interview_id);
    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    // Already finalised — no-op so repeated beacons don't overwrite.
    if (interview.status === 'completed' || interview.status === 'assessed') {
      return NextResponse.json({ success: true, already_finalized: true });
    }

    const safeTranscript = Array.isArray(transcript) ? transcript : [];
    const safeMetadata = metadata && typeof metadata === 'object' ? metadata : undefined;

    await updateInterview(interview_id, {
      status: 'completed',
      transcript: safeTranscript,
      ...(safeMetadata ? { metadata: safeMetadata } : {}),
      ...(typeof duration_seconds === 'number' ? { duration_seconds } : {}),
      completed_at: new Date().toISOString(),
    });

    logInfo('api', 'Interview finalized via beacon', {
      interview_id,
      entries: safeTranscript.length,
      duration_seconds,
    });

    // Trigger assessment only if we have enough signal (assess route enforces
    // the min-4-entry rule too, but checking here avoids an extra request).
    if (safeTranscript.length >= 4) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      fetch(`${baseUrl}/api/interviews/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interview_id }),
      }).catch((err) => {
        console.error('[finalize] assess fire-and-forget failed:', err);
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[finalize] error:', msg);
    logError('api', 'Finalize failed', { error: msg });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
