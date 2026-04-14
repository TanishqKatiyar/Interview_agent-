// ============================================================================
// Cuemath AI Tutor Screener — Speech Context Detection
//
// Automatically determines the speech context (greeting, question, etc.)
// from the text content and current interview phase. This drives the SSML
// prosody styling so the AI voice sounds contextually appropriate.
// ============================================================================

import type { InterviewPhase } from '@/lib/types';
import type { SpeechContext } from '@/lib/ssml';

// ── Encouragement trigger words (case-insensitive) ──────────────────────────

const ENCOURAGEMENT_PATTERNS = [
  'great',
  'love that',
  'excellent',
  'good job',
  'well done',
  "that's wonderful",
  'nice',
  'perfect',
  'impressive',
  'absolutely',
  'exactly right',
  'spot on',
  'fantastic',
  'wonderful',
  'brilliant',
];

// ── Context detector ────────────────────────────────────────────────────────

/**
 * Determines the speech context from text content and interview phase.
 * The result is used by `textToSSML()` to apply appropriate vocal styling.
 *
 * Priority:
 *   1. Phase-based overrides (GREETING → greeting, WRAP_UP → closing)
 *   2. Text heuristics (ends with "?" → question, encouragement words → warm)
 *   3. Default → followup (conversational, engaged)
 */
export function detectSpeechContext(
  text: string,
  phase: InterviewPhase,
): SpeechContext {
  // ── 1. Phase-based overrides ──
  if (phase === 'GREETING') return 'greeting';
  if (phase === 'WRAP_UP' || phase === 'ENDED') return 'closing';

  // ── 2. Text heuristics ──
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // If it ends with a question mark → question tone
  if (trimmed.endsWith('?')) return 'question';

  // If it contains encouragement words → warm/supportive
  for (const pattern of ENCOURAGEMENT_PATTERNS) {
    if (lower.includes(pattern)) return 'encouragement';
  }

  // ── 3. Default ──
  return 'followup';
}
