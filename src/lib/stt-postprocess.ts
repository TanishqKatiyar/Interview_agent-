// ============================================================================
// Cuemath AI Tutor Screener — STT Post-Processing
// Fixes common speech-to-text errors for math tutoring context.
// Used by both Web Speech API results and Whisper results.
// ============================================================================

// ─── Common misrecognition corrections (math tutoring context) ──────────────

const WORD_CORRECTIONS: [RegExp, string][] = [
  // Fragmented words
  [/\bfrac\s*(?:tion|shun|shuns|tions)\b/gi, 'fraction'],
  [/\bfrac\s*shuns\b/gi, 'fractions'],
  [/\bstew\s*(?:dent|dents)\b/gi, 'student'],
  [/\bper\s*cent\s*(?:age|ages)?\b/gi, 'percentage'],
  [/\bmulti\s*(?:pli|ply)\s*(?:cation|kation)\b/gi, 'multiplication'],
  [/\bdivi\s*(?:sion|zhun)\b/gi, 'division'],
  [/\bsub\s*trac\s*(?:tion|shun)\b/gi, 'subtraction'],
  [/\bexplan\s*(?:a|ay)\s*(?:tion|shun)\b/gi, 'explanation'],
  [/\bgeom\s*(?:e|a)\s*tree\b/gi, 'geometry'],
  [/\balge\s*(?:bra|bruh)\b/gi, 'algebra'],
  [/\bcalcul\s*(?:a|ay)\s*(?:tion|shun)\b/gi, 'calculation'],
  [/\bequa\s*(?:tion|shun)\b/gi, 'equation'],
  [/\bnumer\s*(?:a|ay)\s*(?:tor|ter)\b/gi, 'numerator'],
  [/\bdenomi\s*(?:nay|na)\s*(?:tor|ter)\b/gi, 'denominator'],

  // Known misrecognitions in math context
  [/\btraction\b/gi, 'fraction'],   // very common with Indian English
  [/\btouring\b/gi, 'tutoring'],
  [/\bq\s*math\b/gi, 'Cuemath'],
  [/\bqueue\s*math\b/gi, 'Cuemath'],
  [/\bcue\s*mat\b/gi, 'Cuemath'],
  [/\bcue\s*maths?\b/gi, 'Cuemath'],
  [/\bkyu\s*math\b/gi, 'Cuemath'],
  [/\bmental\s*math\b/gi, 'mental math'], // preserve this
  [/\bsubtraction\s*fraction\b/gi, 'subtraction of fractions'],

  // Common speech artifacts
  [/\bgonna\b/gi, 'going to'],
  [/\bwanna\b/gi, 'want to'],
  [/\bkinda\b/gi, 'kind of'],
];

// ─── Filler word detection ──────────────────────────────────────────────────

const FILLER_WORDS = new Set([
  'um', 'uh', 'uhh', 'umm', 'hmm', 'hm', 'ah', 'ahh',
  'er', 'err', 'like', 'you know', 'so', 'well',
  'basically', 'actually', 'right', 'okay', 'ok',
]);

/**
 * Check if text is ONLY filler words (no meaningful content).
 */
export function isFillerOnly(text: string): boolean {
  const words = text.toLowerCase().replace(/[.,!?]/g, '').trim().split(/\s+/);
  if (words.length === 0) return true;
  return words.every((w) => FILLER_WORDS.has(w));
}

// ─── Main post-processing function ──────────────────────────────────────────

/**
 * Clean and correct STT output for math tutoring context.
 * Applied to both Web Speech API and Whisper results.
 */
export function postProcessSTT(raw: string): string {
  let text = raw.trim();

  // Skip garbage: very short + low meaning
  if (text.length < 2) return '';

  // Apply word corrections
  for (const [pattern, replacement] of WORD_CORRECTIONS) {
    text = text.replace(pattern, replacement);
  }

  // Remove repeated words ("the the", "I I")
  text = text.replace(/\b(\w+)\s+\1\b/gi, '$1');

  // Collapse extra whitespace
  text = text.replace(/\s{2,}/g, ' ').trim();

  return text;
}

/**
 * Check if a new result is too similar to the previous one (>80% word overlap).
 * Web Speech API sometimes emits duplicate results on restart.
 */
export function isDuplicate(
  newText: string,
  previousText: string,
  threshold = 0.8,
): boolean {
  if (!previousText) return false;

  const newWords = new Set(newText.toLowerCase().split(/\s+/));
  const prevWords = new Set(previousText.toLowerCase().split(/\s+/));

  if (newWords.size === 0 || prevWords.size === 0) return false;

  let overlapCount = 0;
  for (const word of newWords) {
    if (prevWords.has(word)) overlapCount++;
  }

  const overlapRatio = overlapCount / Math.max(newWords.size, prevWords.size);
  return overlapRatio >= threshold;
}
