// ============================================================================
// POST /api/interviews/assess
// Evaluates a completed interview transcript via Gemini and persists the result.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getInterviewById, updateInterview } from '@/lib/supabase';
import { assessTranscript, generateCoachingFeedback } from '@/lib/gemini';
import { sendAssessmentNotificationEmail } from '@/lib/email';
import type { Assessment, Recommendation } from '@/lib/types';
import { assessLimiter } from '@/lib/rate-limiter';
import { sanitizeName } from '@/lib/sanitize';
import { logInfo, logError } from '@/lib/logger';
import { analyzeSpeechPatterns } from '@/lib/speech-analytics';
import { analyzeIntegrity } from '@/lib/integrity-analysis';
import { assessInterviewQuality } from '@/lib/interview-quality';
import { calculateHiringScore } from '@/lib/scoring-engine';
import { listInterviews } from '@/lib/supabase';

// ─── Dimension weights (must match gemini.ts rubric) ─────────────────────────

const WEIGHTS = {
  communication_clarity: 0.25,
  warmth_and_rapport: 0.20,
  simplification_ability: 0.25,
  patience_indicators: 0.20,
  english_fluency: 0.10,
} as const;

type DimensionKey = keyof typeof WEIGHTS;

const DIMENSION_KEYS: DimensionKey[] = [
  'communication_clarity',
  'warmth_and_rapport',
  'simplification_ability',
  'patience_indicators',
  'english_fluency',
];

// ─── Score validation helpers ─────────────────────────────────────────────────

/**
 * Recalculate the weighted overall score from raw dimension scores.
 * Returns a number rounded to 1 decimal place.
 */
function recalculateOverallScore(assessment: Assessment): number {
  const raw = DIMENSION_KEYS.reduce((sum, key) => {
    const score = assessment.dimensions[key]?.score ?? 3;
    return sum + score * WEIGHTS[key];
  }, 0);

  return Math.round(raw * 10) / 10;
}

/**
 * Derive the correct recommendation label from the rubric rules.
 * Overrides whatever Gemini returned if the math doesn't match.
 */
function deriveRecommendation(
  overall: number,
  assessment: Assessment,
): Recommendation {
  const scores = DIMENSION_KEYS.map((k) => assessment.dimensions[k]?.score ?? 3);
  const countBelowTwoFive = scores.filter((s) => s < 2.5).length;
  const anyBelowThreeFive = scores.some((s) => s < 3.5);
  const anyBelowTwoFive = countBelowTwoFive > 0;
  const hasRedFlags = (assessment.red_flags ?? []).length > 0;

  if (hasRedFlags || countBelowTwoFive >= 2 || overall < 3.0) return 'fail';
  if (overall >= 4.0 && !anyBelowThreeFive) return 'strong_pass';
  if (overall >= 3.5 && !anyBelowTwoFive) return 'pass';
  return 'borderline';
}

/**
 * Validate that all required top-level and dimension fields are present
 * in the Assessment object returned by Gemini.
 */
function assertRequiredFields(assessment: Assessment): void {
  if (!assessment.dimensions) {
    throw new Error('Assessment is missing "dimensions" object');
  }

  for (const key of DIMENSION_KEYS) {
    const dim = assessment.dimensions[key];
    if (!dim) {
      throw new Error(`Assessment is missing dimension: ${key}`);
    }
    if (typeof dim.score !== 'number') {
      throw new Error(`Dimension "${key}" has non-numeric score`);
    }
    if (dim.score < 1 || dim.score > 5) {
      throw new Error(`Dimension "${key}" score out of range: ${dim.score}`);
    }
  }

  const requiredTopLevel: (keyof Assessment)[] = [
    'overall_score',
    'recommendation',
    'red_flags',
    'strengths',
    'areas_for_improvement',
    'summary',
    'confidence',
  ];

  for (const field of requiredTopLevel) {
    if (assessment[field] === undefined || assessment[field] === null) {
      throw new Error(`Assessment is missing required field: "${field}"`);
    }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { allowed, retryAfterMs } = assessLimiter.check(ip, 5, 60 * 1000);
  
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  try {
    // ── 1. Parse and validate request body ──────────────────────────────────
    let body: { interview_id?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const { interview_id } = body;

    if (!interview_id || typeof interview_id !== 'string' || !interview_id.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: interview_id' },
        { status: 400 },
      );
    }

    console.log(`[assess] Starting assessment for interview: ${interview_id}`);
    logInfo('api', 'Assessment started', { interview_id });

    // ── 2. Fetch interview from Supabase ────────────────────────────────────
    const interview = await getInterviewById(interview_id);

    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found', interview_id },
        { status: 404 },
      );
    }

    // ── 3. Validate interview is eligible for assessment ────────────────────
    if (interview.status !== 'completed') {
      return NextResponse.json(
        {
          error: 'Interview cannot be assessed yet',
          details: `Expected status "completed", got "${interview.status}"`,
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(interview.transcript) || interview.transcript.length < 4) {
      return NextResponse.json(
        {
          error: 'Transcript too short for reliable assessment',
          details: `Transcript has ${interview.transcript?.length ?? 0} entries; minimum is 4`,
        },
        { status: 400 },
      );
    }

    if (!interview.metadata) {
      return NextResponse.json(
        { error: 'Interview metadata is missing — cannot assess' },
        { status: 400 },
      );
    }

    // ── 4. Run assessment via Gemini & Deep Intelligence Extractors ───────────
    console.log(`[assess] Calling Gemini & Deep Intelligence for interview: ${interview_id}`);
    const assessStart = Date.now();
    let assessment: Assessment;
    let integrityReport;
    
    // Fast pure-computation logic
    const speechAnalytics = analyzeSpeechPatterns(interview.transcript, interview.metadata);
    const interviewQuality = assessInterviewQuality(interview.transcript, interview.metadata);

    try {
      // Run Gemini Rubric Evaluator and Groq Integrity Checker concurrently
      const [rubricEval, integrity] = await Promise.all([
        assessTranscript(interview.transcript, interview.metadata),
        analyzeIntegrity(interview.transcript, interview.metadata, speechAnalytics)
      ]);
      assessment = rubricEval;
      integrityReport = integrity;
    } catch (geminiErr) {
      const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      console.error(`[assess] AI assessment failed for ${interview_id}:`, msg);
      logError('api', 'Assessment failed', { interview_id, error: msg });
      return NextResponse.json(
        { error: 'Assessment failed', details: msg },
        { status: 500 },
      );
    }

    // ── 5. Validate all required fields exist ───────────────────────────────
    try {
      assertRequiredFields(assessment);
    } catch (validationErr) {
      const msg = validationErr instanceof Error ? validationErr.message : String(validationErr);
      console.error(`[assess] Validation error for ${interview_id}:`, msg);
      return NextResponse.json(
        { error: 'Assessment output is malformed', details: msg },
        { status: 500 },
      );
    }

    // ── 6. Recalculate score and verify recommendation ──────────────────────
    const overallScore = recalculateOverallScore(assessment);
    const correctRecommendation = deriveRecommendation(overallScore, assessment);

    if (assessment.overall_score !== overallScore) {
      console.log(
        `[assess] Correcting overall_score: ${assessment.overall_score} → ${overallScore}`,
      );
      assessment.overall_score = overallScore;
    }

    if (assessment.recommendation !== correctRecommendation) {
      console.log(
        `[assess] Overriding recommendation: ${assessment.recommendation} → ${correctRecommendation} (score: ${overallScore})`,
      );
      assessment.recommendation = correctRecommendation;
    }

    // ── 7. Calculate Systems-Level Hiring Score ─────────────────────────────
    const allHistorical = await listInterviews(500).catch(() => []);
    
    // Create a temporary mock of the interview object fully populated for scoring
    const fullInterviewObj: any = {
      ...interview,
      assessment,
      overall_score: overallScore,
      recommendation: correctRecommendation,
      speech_analytics: speechAnalytics,
      integrity_report: integrityReport,
      interview_quality: interviewQuality
    };

    const hiringScore = calculateHiringScore(fullInterviewObj, allHistorical);

    // ── 8. Persist to Supabase ──────────────────────────────────────────────
    console.log(
      `[assess] Saving to Supabase — score: ${overallScore}, rec: ${correctRecommendation}`,
    );

    await updateInterview(interview_id, {
      assessment,
      overall_score: overallScore,
      recommendation: correctRecommendation,
      speech_analytics: speechAnalytics,
      integrity_report: integrityReport,
      interview_quality: interviewQuality,
      hiring_score: hiringScore,
      status: 'assessed',
    });

    console.log(`[assess] Assessment complete for interview: ${interview_id}`);

    logInfo('api', 'Assessment completed', {
      interview_id,
      overall_score: overallScore,
      recommendation: correctRecommendation,
      latency_ms: Date.now() - assessStart,
    });

    // ── 8. Send admin notification (fire-and-forget) ────────────────────────
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    if (adminEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const durationSec = interview.duration_seconds ?? 0;
      const durationStr = durationSec
        ? `${Math.floor(durationSec / 60)}:${(durationSec % 60).toString().padStart(2, '0')}`
        : '—';
      const interviewDate = interview.created_at
        ? new Date(interview.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : '—';
      const summaryText =
        typeof assessment.summary === 'string'
          ? assessment.summary.split('\n')[0].slice(0, 300)
          : '';

      sendAssessmentNotificationEmail({
        adminEmail,
        candidateName: interview.candidate_name,
        score: overallScore,
        recommendation: correctRecommendation,
        interviewDate,
        duration: durationStr,
        summary: summaryText,
        detailUrl: `${appUrl}/admin/${interview_id}`,
      }).catch((err) => {
        console.error('[assess] Admin notification failed:', err);
      });
    } else {
      console.log('[assess] No ADMIN_NOTIFICATION_EMAIL set — skipping notification');
    }

    // ── 9. Generate coaching feedback (awaited — must complete before lambda dies) ──
    try {
      const coachingResult = await Promise.race([
        generateCoachingFeedback(interview.transcript),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 25_000)), // 25s timeout
      ]);
      
      if (coachingResult && coachingResult.length > 0) {
        await updateInterview(interview_id, { coaching_feedback: coachingResult });
        console.log(`[assess] Coaching feedback saved (${coachingResult.length} tips)`);
        logInfo('api', 'Coaching feedback generated', { interview_id, tip_count: coachingResult.length });
      } else {
        // Save empty array so polling can detect "done but empty" vs "not started"
        await updateInterview(interview_id, { coaching_feedback: [] });
        console.log('[assess] Coaching feedback timed out or returned empty — saved empty array');
      }
    } catch (err) {
      console.error('[assess] Coaching feedback failed:', err);
      // Save empty array so the client stops polling
      await updateInterview(interview_id, { coaching_feedback: [] }).catch(() => {});
    }

    // ── 10. Return success ──────────────────────────────────────────────────
    return NextResponse.json(
      { success: true, assessment },
      { status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[assess] Unexpected error:', msg, err);
    return NextResponse.json(
      { error: 'Internal server error', details: msg },
      { status: 500 },
    );
  }
}
