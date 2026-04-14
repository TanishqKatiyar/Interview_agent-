// ============================================================================
// Cuemath AI Tutor Screener — Emergency Responses
// Pre-written fallback responses for each interview phase.
// Used when the LLM (Groq) is unreachable or times out.
// These keep the interview flowing naturally — the candidate never knows.
// ============================================================================

import type { InterviewPhase } from './types';

const EMERGENCY_POOL: Record<Exclude<InterviewPhase, 'ENDED'>, string[]> = {
  GREETING: [
    "So what got you into tutoring in the first place?",
  ],
  WARM_UP: [
    "Cool! Have you worked with kids much? Like what ages?",
    "Nice. So what's your favorite thing about math?",
  ],
  CORE_ASSESSMENT: [
    "Alright here's one — how would you explain fractions to a 9-year-old?",
    "Okay so imagine a student's been stuck for 5 minutes and they're getting frustrated. What do you do?",
    "What do you think separates a great math tutor from an okay one?",
  ],
  SCENARIO: [
    "Okay fun thing — pretend I'm a confused 10-year-old. Explain fractions to me like I'm your student.",
    "Hmm I still don't get it. Why can't I just add the top numbers?",
    "Ohhh wait, is it like pizza slices? Okay that makes more sense.",
  ],
  WRAP_UP: [
    "Alright that's everything! Thanks so much for chatting, you'll hear from us in a couple days. Take care!",
  ],
};

// Track which index we've used per phase
const usedIndices: Record<string, number> = {};

/**
 * Returns the next unused emergency response for the given phase.
 * If all responses for that phase are exhausted, advances through
 * subsequent phases until it finds one.
 *
 * This function is stateful — it remembers which responses have been used
 * across the lifetime of the page.
 */
export function getNextEmergencyResponse(phase: InterviewPhase): string {
  // Phase ordering for fallback traversal
  const phaseOrder: Exclude<InterviewPhase, 'ENDED'>[] = [
    'GREETING',
    'WARM_UP',
    'CORE_ASSESSMENT',
    'SCENARIO',
    'WRAP_UP',
  ];

  // If ENDED somehow gets passed in, just say goodbye
  if (phase === 'ENDED') {
    return "Thanks so much for chatting! You did great. You'll hear from us soon.";
  }

  // Start from the requested phase, then try subsequent phases
  const startIdx = phaseOrder.indexOf(phase as Exclude<InterviewPhase, 'ENDED'>);
  for (let i = startIdx; i < phaseOrder.length; i++) {
    const p = phaseOrder[i];
    const pool = EMERGENCY_POOL[p];
    const used = usedIndices[p] ?? 0;

    if (used < pool.length) {
      usedIndices[p] = used + 1;
      console.error(
        `[RECOVERY] Using emergency response for phase "${p}" (index ${used})`
      );
      return pool[used];
    }
  }

  // Absolute last resort — everything exhausted
  return "Alright, I think we've covered a lot! Thanks for your time today — you'll hear from us soon. Take care!";
}

/**
 * Resets the emergency response tracker.
 * Call this when starting a fresh interview.
 */
export function resetEmergencyResponses(): void {
  Object.keys(usedIndices).forEach((key) => delete usedIndices[key]);
}
