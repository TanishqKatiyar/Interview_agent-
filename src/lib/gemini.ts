// ============================================================================
// Cuemath AI Tutor Screener — LLM Integration (Groq primary, Gemini fallback)
// Sends conversation history to LLM and parses responses.
// ============================================================================

import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import Groq from 'groq-sdk';
import type {
  TranscriptEntry,
  InterviewMetadata,
  Assessment,
  CoachingTip,
} from './types';

// ─── Constants ──────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.0-flash';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_ASSESSMENT_MODEL = 'llama-3.3-70b-versatile';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

/** When transcript exceeds this many entries, summarise the middle. */
const CONTEXT_WINDOW_THRESHOLD = 30;
/** Keep the first N entries (greeting context). */
const KEEP_FIRST = 2;
/** Keep the last N entries (recent context). */
const KEEP_LAST = 10;

const FALLBACK_RESPONSE =
  "Sorry, I missed that. Could you say that one more time?";

// ─── LLM Clients ────────────────────────────────────────────────────────────

let _genAI: GoogleGenerativeAI | null = null;
let _groq: Groq | null = null;

export function getGroq(): Groq | null {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;
    _groq = new Groq({ apiKey });
  }
  return _groq;
}

export function getGenAI(): GoogleGenerativeAI | null {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

// ─── Assessment Prompt Template (Production Rubric) ─────────────────────────

const ASSESSMENT_PROMPT_TEMPLATE = `You are an expert talent evaluator for Cuemath, an online math tutoring company for kids ages 6-16. You are assessing a tutor candidate based on their screening interview transcript.

Evaluate the candidate on 5 dimensions and provide a hiring recommendation with evidence.

RUBRIC:

1. COMMUNICATION CLARITY (Weight: 25%)
1 = Incoherent, unstructured, grammatically broken
2 = Understandable but disorganized, frequently vague
3 = Clear enough, occasionally loses thread
4 = Well-structured, good vocabulary, easy to follow
5 = Exceptionally articulate, explains complex ideas with striking clarity
Look for: Logical structure, concrete examples, complete well-formed sentences.

2. WARMTH AND RAPPORT (Weight: 20%)
1 = Cold, mechanical, no personality
2 = Polite but emotionally distant
3 = Friendly, appropriate warmth
4 = Genuinely warm, encouraging, approachable
5 = Exceptional warmth — would make any student feel safe and valued
Look for: Encouraging language, genuine interest in students, inviting tone.

3. SIMPLIFICATION ABILITY (Weight: 25%)
1 = Cannot simplify, uses jargon, makes things harder
2 = Attempts to simplify but still too complex
3 = Adequate simplification, some analogies
4 = Good at breaking down concepts, relatable analogies, age-appropriate
5 = Masterful — creative analogies, perfect age-calibration, builds understanding step by step
Look for: Real-world examples, step-by-step breakdowns, checking understanding, age-appropriate language.

4. PATIENCE INDICATORS (Weight: 20%)
1 = Impatient, dismissive, blames the student
2 = Somewhat patient but gives up easily
3 = Patient, no visible frustration
4 = Very patient, multiple approaches, stays encouraging
5 = Turns frustration into teaching moments, radiates calm, never gives up
Look for: How they handle stuck students, multiple approaches, ownership of confusion vs blaming student. The role-play section is the strongest evidence here.

5. ENGLISH FLUENCY (Weight: 10%)
1 = Severe fluency issues
2 = Noticeable issues that impede understanding
3 = Good fluency with minor issues
4 = Very fluent, natural speech
5 = Fully fluent, native-level
Note: This was a voice interview transcribed by speech recognition. Minor transcription artifacts should not count against fluency. Focus on sentence structure, vocabulary range, natural phrasing.

RED FLAGS (automatic fail regardless of scores):
- Inappropriate or offensive language
- Unwillingness to work with certain student types
- Factual mathematical errors in explanations
- Dismissive attitude toward struggling students
- Interview under 3 minutes (unreliable assessment)

SCORING:
- Use 0.5 increments (1.0, 1.5, 2.0 ... 5.0)
- Overall = (Communication × 0.25) + (Warmth × 0.20) + (Simplification × 0.25) + (Patience × 0.20) + (Fluency × 0.10)
- Strong Pass: overall >= 4.0 AND every dimension >= 3.5
- Pass: overall >= 3.5 AND every dimension >= 2.5
- Borderline: overall >= 3.0 OR exactly one dimension < 2.5
- Fail: overall < 3.0 OR two+ dimensions < 2.5

TRANSCRIPT:
{transcript}

METADATA:
{metadata}

INSTRUCTIONS:
1. Read the full transcript carefully
2. For each dimension, quote or closely paraphrase specific things the candidate said as evidence
3. Weight the SCENARIO/role-play section most heavily — it best simulates real tutoring
4. Compare against what an ideal tutor would say
5. Be fair but rigorous — "pass" means you'd trust this person with your own child

Respond ONLY with valid JSON, no markdown fences, no explanation before or after:
{
  "dimensions": {
    "communication_clarity": { "score": <number>, "evidence": ["<specific quote or paraphrase>"], "reasoning": "<2-3 sentences>" },
    "warmth_and_rapport": { "score": <number>, "evidence": ["<quote>"], "reasoning": "<explanation>" },
    "simplification_ability": { "score": <number>, "evidence": ["<quote>"], "reasoning": "<explanation>" },
    "patience_indicators": { "score": <number>, "evidence": ["<quote>"], "reasoning": "<explanation>" },
    "english_fluency": { "score": <number>, "evidence": ["<quote>"], "reasoning": "<explanation>" }
  },
  "overall_score": <number>,
  "recommendation": "<strong_pass|pass|borderline|fail>",
  "red_flags": [],
  "strengths": ["<strength>", "<strength>"],
  "areas_for_improvement": ["<area>", "<area>"],
  "summary": "<Two paragraphs: overall impression + key strengths, then growth areas + final judgment>",
  "confidence": "<high|medium|low>",
  "teaching_persona": {
    "type": "<patient_guide|enthusiastic_explainer|structured_coach|empathetic_mentor|adaptive_solver>",
    "label": "<The Patient Guide|The Enthusiastic Explainer|The Structured Coach|The Empathetic Mentor|The Adaptive Problem-Solver>",
    "description": "<2 sentences explaining why this persona fits based on the transcript>",
    "best_for": "<Age range and student type this persona is best suited for>"
  }
}

TEACHING PERSONA GUIDE (pick the ONE that best fits):
1. "patient_guide" / "The Patient Guide" — methodical, step-by-step, checks understanding frequently, never rushes. Best for: younger kids (6-9) who need careful scaffolding.
2. "enthusiastic_explainer" / "The Enthusiastic Explainer" — energetic, uses creative analogies, makes math exciting. Best for: kids (8-12) who say "math is boring."
3. "structured_coach" / "The Structured Coach" — organized, follows clear frameworks, data-driven approach. Best for: older students (12-16) preparing for exams.
4. "empathetic_mentor" / "The Empathetic Mentor" — focuses on emotions first, builds confidence before tackling concepts. Best for: anxious students or those who say "I'm bad at math."
5. "adaptive_solver" / "The Adaptive Problem-Solver" — reads the student quickly, switches approaches mid-explanation. Best for: mixed-ability groups or diverse learning needs.`;


// ─── Helpers ────────────────────────────────────────────────────────────────

/** Pause execution for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert our TranscriptEntry[] into Gemini's Content[] format.
 * Applies context-window summarisation when the transcript is long.
 */
function transcriptToContents(transcript: TranscriptEntry[]): Content[] {
  const entries =
    transcript.length > CONTEXT_WINDOW_THRESHOLD
      ? compressTranscript(transcript)
      : transcript;

  return entries.map((entry) => ({
    role: entry.role === 'ai' ? 'model' : 'user',
    parts: [{ text: entry.content }],
  }));
}

/**
 * Summarise the middle portion of a long transcript to stay within
 * a reasonable context window.
 */
function compressTranscript(transcript: TranscriptEntry[]): TranscriptEntry[] {
  const head = transcript.slice(0, KEEP_FIRST);
  const tail = transcript.slice(-KEEP_LAST);
  const middle = transcript.slice(KEEP_FIRST, -KEEP_LAST);

  // Build a human-readable summary of the middle entries
  const candidatePoints: string[] = [];
  const questionsAsked: string[] = [];

  for (const entry of middle) {
    if (entry.role === 'ai') {
      // Extract questions (lines ending with ?)
      const questions = entry.content
        .split(/[.!?]+/)
        .filter((s) => entry.content.includes(s.trim() + '?'))
        .map((s) => s.trim())
        .filter(Boolean);
      questionsAsked.push(...questions);
    } else {
      // Take first 60 chars of each candidate response as a topic hint
      candidatePoints.push(
        entry.content.length > 60
          ? entry.content.slice(0, 57) + '…'
          : entry.content,
      );
    }
  }

  const summaryText = [
    '[Summary of earlier conversation:',
    candidatePoints.length > 0
      ? `Candidate discussed: ${candidatePoints.join('; ')}.`
      : '',
    questionsAsked.length > 0
      ? `Questions asked: ${questionsAsked.join('; ')}.`
      : '',
    `${middle.length} messages summarised.]`,
  ]
    .filter(Boolean)
    .join(' ');

  const summaryEntry: TranscriptEntry = {
    role: 'ai',
    content: summaryText,
    timestamp: middle[0]?.timestamp ?? 0,
    phase: middle[0]?.phase ?? 'CORE_ASSESSMENT',
  };

  return [...head, summaryEntry, ...tail];
}

// ─── Response Cleaning ──────────────────────────────────────────────────────

/**
 * Strip markdown, emoji, and excess length from a Gemini response so it
 * sounds natural when spoken aloud via TTS.
 */
function cleanResponseForVoice(raw: string): string {
  let text = raw;

  // Strip markdown formatting: **, *, ##, -, bullet points
  text = text.replace(/#{1,6}\s*/g, '');         // headings
  text = text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1'); // bold/italic
  text = text.replace(/^[\s]*[-•*]\s+/gm, '');   // bullet points
  text = text.replace(/`([^`]+)`/g, '$1');        // inline code
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // links

  // Strip emoji (Unicode emoji ranges)
  text = text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu,
    '',
  );

  // Collapse whitespace
  text = text.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // Truncate to 3 sentences max (safety net for verbose responses)
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 3) {
    text = sentences.slice(0, 3).join('').trim();
  }

  return text;
}



// ═════════════════════════════════════════════════════════════════════════════
// getInterviewerResponse
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Send the conversation to the LLM and get the next interviewer utterance.
 * Tries Groq first (fast + generous free tier), falls back to Gemini.
 *
 * @param systemPrompt  Phase-specific system instructions.
 * @param transcript    Full conversation so far.
 * @returns             Cleaned, voice-ready response string.
 */
export async function getInterviewerResponse(
  systemPrompt: string,
  transcript: TranscriptEntry[],
): Promise<string> {
  // ── Try Groq first ──
  const groq = getGroq();
  if (groq) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(
          `[Groq] Requesting interviewer response (attempt ${attempt + 1}/${MAX_RETRIES + 1})…`,
        );

        const messages = [
          { role: 'system' as const, content: systemPrompt },
          ...transcript.map((entry) => ({
            role: (entry.role === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
            content: entry.content,
          })),
        ];

        const result = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages,
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 150,
        });

        const raw = result.choices[0]?.message?.content;
        if (!raw) throw new Error('Empty response from Groq');

        const cleaned = cleanResponseForVoice(raw);
        console.log('[Groq] Response:', cleaned);
        return cleaned;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Groq] Attempt ${attempt + 1} failed:`, msg);
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
      }
    }
    console.warn('[Groq] All retries failed, trying Gemini fallback…');
  }

  // ── Gemini fallback ──
  const genAI = getGenAI();
  if (genAI) {
    const contents = transcriptToContents(transcript);
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(
          `[Gemini] Requesting interviewer response (attempt ${attempt + 1}/${MAX_RETRIES + 1})…`,
        );

        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          systemInstruction: systemPrompt,
          generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 150 },
        });

        const result = await model.generateContent({ contents });
        const raw = result.response.text();
        if (!raw) throw new Error('Empty response');

        const cleaned = cleanResponseForVoice(raw);
        console.log('[Gemini] Response:', cleaned);
        return cleaned;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Gemini] Attempt ${attempt + 1} failed:`, msg);
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
      }
    }
  }

  // All providers exhausted
  console.error('[LLM] All providers failed. Using fallback response.');
  return FALLBACK_RESPONSE;
}

// ═════════════════════════════════════════════════════════════════════════════
// assessTranscript
// ═════════════════════════════════════════════════════════════════════════════



/**
 * Extract a JSON object robustly from a raw Gemini response string.
 * Handles:
 *  - Leading/trailing whitespace
 *  - ` ```json ``` ` or ` ``` ``` ` code fences
 *  - Any preamble text before the opening `{`
 *  - Any postamble text after the closing `}`
 */
function extractJson(raw: string): string {
  let text = raw.trim();

  // Strip code fences: ```json...``` or ```...```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // Find the first '{' and its matching '}' using brace-depth tracking
  const braceStart = text.indexOf('{');
  if (braceStart === -1) return text;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = braceStart; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(braceStart, i + 1);
    }
  }

  // Fallback: return from first '{' to end
  return text.slice(braceStart);
}

/**
 * Evaluate a completed interview transcript and return a structured
 * Assessment object. Tries Groq first, falls back to Gemini.
 *
 * @param transcript Full conversation transcript.
 * @param metadata   Interview statistics (duration, speaking times, etc.).
 * @returns          Validated Assessment object.
 */
export async function assessTranscript(
  transcript: TranscriptEntry[],
  metadata: InterviewMetadata,
): Promise<Assessment> {
  const transcriptJson = JSON.stringify(transcript, null, 2);
  const metadataJson = JSON.stringify(metadata, null, 2);

  const basePrompt = ASSESSMENT_PROMPT_TEMPLATE
    .replace('{transcript}', transcriptJson)
    .replace('{metadata}', metadataJson);

  const correctionSuffix =
    '\n\nYour previous response was not valid JSON. ' +
    'Please respond with ONLY a JSON object, no code fences, no explanation. ' +
    'Start your response with { and end it with }.';

  let lastRawResponse = '';

  // ── Try Groq first ──
  const groq = getGroq();
  if (groq) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const promptText = attempt === 0 ? basePrompt : basePrompt + correctionSuffix;
      try {
        console.log(
          `[Groq] Assessment attempt ${attempt + 1}/2 using ${GROQ_ASSESSMENT_MODEL}…`,
        );

        const result = await groq.chat.completions.create({
          model: GROQ_ASSESSMENT_MODEL,
          messages: [{ role: 'user', content: promptText }],
          temperature: 0.3,
          max_tokens: 4096,
        });

        const raw = result.choices[0]?.message?.content;
        if (!raw || !raw.trim()) throw new Error('Groq returned an empty response');

        lastRawResponse = raw;
        const extracted = extractJson(raw);
        const parsed = JSON.parse(extracted) as Assessment;
        const validated = validateAssessment(parsed);

        console.log(
          `[Groq] Assessment complete (attempt ${attempt + 1}). Score:`,
          validated.overall_score, '→', validated.recommendation,
        );
        return validated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Groq] Assessment attempt ${attempt + 1} failed:`, msg);
        if (attempt < 1) await sleep(RETRY_DELAY_MS);
      }
    }
    console.warn('[Groq] Assessment failed, trying Gemini fallback…');
  }

  // ── Gemini fallback ──
  const genAI = getGenAI();
  if (genAI) {
    const GEMINI_ASSESSMENT_MODELS = ['gemini-2.5-pro', 'gemini-2.0-flash'] as const;

    for (let attempt = 0; attempt < 3; attempt++) {
      const modelName = attempt === 0 ? GEMINI_ASSESSMENT_MODELS[0] : GEMINI_ASSESSMENT_MODELS[1];
      const promptText = attempt === 0 ? basePrompt : basePrompt + correctionSuffix;

      try {
        console.log(
          `[Gemini] Assessment attempt ${attempt + 1}/3 using ${modelName}…`,
        );

        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        });

        const result = await model.generateContent(promptText);
        const raw = result.response.text();
        if (!raw || !raw.trim()) throw new Error('Gemini returned an empty response');

        lastRawResponse = raw;
        const extracted = extractJson(raw);
        const parsed = JSON.parse(extracted) as Assessment;
        const validated = validateAssessment(parsed);

        console.log(
          `[Gemini] Assessment complete (attempt ${attempt + 1}). Score:`,
          validated.overall_score, '→', validated.recommendation,
        );
        return validated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Gemini] Assessment attempt ${attempt + 1} failed:`, msg);
        if (attempt < 2) await sleep(RETRY_DELAY_MS);
      }
    }
  }

  // All providers failed
  console.error(
    '[LLM] All assessment attempts failed. Last raw response:',
    lastRawResponse.slice(0, 500),
  );
  throw new Error(
    `Assessment failed after all attempts. Raw response snippet: ${lastRawResponse.slice(0, 200)}`,
  );
}

// ─── Assessment Helpers ─────────────────────────────────────────────────────

// ─── Dimension weights for overall score calculation ────────────────────────

const DIMENSION_WEIGHTS: Record<string, number> = {
  communication_clarity: 0.25,
  warmth_and_rapport: 0.20,
  simplification_ability: 0.25,
  patience_indicators: 0.20,
  english_fluency: 0.10,
};

/**
 * Robust validation: ensure all required Assessment fields exist, clamp
 * scores, recalculate the weighted overall_score, and enforce the
 * recommendation rules (overriding Gemini's recommendation if the math
 * doesn't match the rubric).
 */
function validateAssessment(raw: Assessment): Assessment {
  const dims = raw.dimensions;
  const dimensionKeys = [
    'communication_clarity',
    'warmth_and_rapport',
    'simplification_ability',
    'patience_indicators',
    'english_fluency',
  ] as const;

  // ── 1. Ensure every dimension exists with valid shape ──
  for (const key of dimensionKeys) {
    if (!dims[key]) {
      dims[key] = { score: 3, evidence: [], reasoning: 'Unable to assess.' };
    }
    dims[key].score = clampScore(dims[key].score);
    dims[key].evidence = Array.isArray(dims[key].evidence)
      ? dims[key].evidence.filter((e: unknown) => typeof e === 'string')
      : [];
    dims[key].reasoning =
      typeof dims[key].reasoning === 'string' ? dims[key].reasoning : '';
  }

  // ── 2. Recalculate weighted overall score ──
  const calculated = dimensionKeys.reduce(
    (sum, key) => sum + dims[key].score * DIMENSION_WEIGHTS[key],
    0,
  );
  // Round to nearest 0.5
  raw.overall_score = Math.round(calculated * 2) / 2;

  // ── 3. Determine correct recommendation from rubric rules ──
  const scores = dimensionKeys.map((k) => dims[k].score);
  const dimsBelowTwoFive = scores.filter((s) => s < 2.5).length;
  const anyBelowThreeFive = scores.some((s) => s < 3.5);
  const anyBelowTwoFive = dimsBelowTwoFive > 0;
  const hasRedFlags = (raw.red_flags ?? []).length > 0;

  let correctRec: Assessment['recommendation'];

  if (hasRedFlags || dimsBelowTwoFive >= 2 || raw.overall_score < 3.0) {
    correctRec = 'fail';
  } else if (raw.overall_score >= 4.0 && !anyBelowThreeFive) {
    correctRec = 'strong_pass';
  } else if (raw.overall_score >= 3.5 && !anyBelowTwoFive) {
    correctRec = 'pass';
  } else {
    correctRec = 'borderline';
  }

  // Override Gemini's recommendation if it doesn't match the rubric
  if (raw.recommendation !== correctRec) {
    console.log(
      `[Gemini] Overriding recommendation: ${raw.recommendation} → ${correctRec} (score: ${raw.overall_score})`,
    );
    raw.recommendation = correctRec;
  }

  // ── 4. Validate / default remaining fields ──
  const validConfidence = ['high', 'medium', 'low'];
  if (!validConfidence.includes(raw.confidence)) {
    raw.confidence = 'medium';
  }

  raw.red_flags = Array.isArray(raw.red_flags) ? raw.red_flags : [];
  raw.strengths = Array.isArray(raw.strengths) ? raw.strengths : [];
  raw.areas_for_improvement = Array.isArray(raw.areas_for_improvement)
    ? raw.areas_for_improvement
    : [];
  raw.summary =
    typeof raw.summary === 'string' && raw.summary.length > 0
      ? raw.summary
      : 'Assessment completed.';

  return raw;
}

/** Clamp a score to 1–5 in 0.5 increments. */
function clampScore(score: number): number {
  const clamped = Math.max(1, Math.min(5, score));
  return Math.round(clamped * 2) / 2; // Round to nearest 0.5
}

// ═════════════════════════════════════════════════════════════════════════════
// PRACTICE MODE (Feature 5)
// ═════════════════════════════════════════════════════════════════════════════

const PRACTICE_SYSTEM_PROMPT = `You are Nisha from Cuemath, running a brief PRACTICE session. This is NOT a real interview. Your primary job is to warmly encourage the candidate and prepare them for the real thing.

Rules:
1. You will ask 2 easy warm-up questions.
   - Question 1: "Tell me a little bit about yourself and why you're interested in tutoring."
   - Question 2: "How would you explain what addition means to a very young child?"
2. After the candidate's first answer, give them brief, encouraging feedback (1-2 sentences) before asking Question 2.
3. Focus your feedback on concrete things: answer length (too short? too long?), clarity, and whether they used examples.
4. VERY IMPORTANT: To fix robotic AI voices, use conversational filler words mid-sentence ("I mean", "you know", "like", "gotcha", "yeah"). Use short, punchy sentence fragments instead of perfect paragraphs.
5. After their second answer, end the practice session immediately by saying: "Great practice! You're all set. When you're ready for the real thing, hit the button to start your official interview."

NEVER score them. NEVER be harsh. Keep all your responses extremely brief (under 50 words). Reply directly with your spoken response.`;

export async function getPracticeResponse(
  transcript: TranscriptEntry[]
): Promise<{ text: string }> {
  // Convert transcript into unified text representation
  const messages = transcript.map((t) => {
    return `${t.role === 'ai' ? 'Nisha' : 'Candidate'}: ${t.content}`;
  });

  const prompt = `${PRACTICE_SYSTEM_PROMPT}\n\nHere is the practice transcript so far:\n${messages.join('\n')}\n\nNisha:`;

  // Try Groq
  const groq = getGroq();
  if (groq) {
    try {
      const result = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 250,
      });
      const raw = result.choices[0]?.message?.content?.trim();
      if (raw) return { text: raw };
    } catch (err) {
      console.error('[Practice] Groq failed:', err);
    }
  }

  // Gemini Fallback
  const genAI = getGenAI();
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: { temperature: 0.7, maxOutputTokens: 250 },
      });
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();
      if (raw) return { text: raw };
    } catch (err) {
      console.error('[Practice] Gemini failed:', err);
    }
  }

  return { text: "Great effort so far! Next question: How would you explain what addition means to a very young child?" };
}

// ═════════════════════════════════════════════════════════════════════════════
// POST-INTERVIEW ASSESSMENT (Groq primary, Gemini fallback)
// ═════════════════════════════════════════════════════════════════════════════

const COMPARE_PROMPT = `Given the following candidate assessment summaries, write a brief, 3-4 sentence comparison highlighting key differences and mentioning which candidate would be best suited for different student types or profiles.
    
Candidate Summaries:
{summaries}

Focus ONLY on the comparison narrative. Do not add salutations or closing remarks.`;

/**
 * Generates a short AI comparison of multiple candidates based on their assessment summaries.
 */
export async function generateComparisonSummary(
  candidates: { name: string; summary: string }[]
): Promise<string> {
  if (candidates.length < 2) return '';

  const summariesText = candidates
    .map((c) => `--- CANDIDATE: ${c.name} ---\n${c.summary}`)
    .join('\n\n');

  const prompt = COMPARE_PROMPT.replace('{summaries}', summariesText);

  // Try Groq
  const groq = getGroq();
  if (groq) {
    try {
      const result = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 500,
      });
      const raw = result.choices[0]?.message?.content?.trim();
      if (raw) return raw;
    } catch (err) {
      console.error('[Compare] Groq failed:', err);
    }
  }

  // Gemini Fallback
  const genAI = getGenAI();
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: { temperature: 0.6, maxOutputTokens: 500 },
      });
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();
      if (raw) return raw;
    } catch (err) {
      console.error('[Compare] Gemini failed:', err);
    }
  }

  return 'Comparison temporarily unavailable.';
}


// ═════════════════════════════════════════════════════════════════════════════
// generateCoachingFeedback  (Feature 1)
// ═════════════════════════════════════════════════════════════════════════════

const COACHING_PROMPT = `Based on this interview transcript, generate 3-5 brief coaching tips for the candidate to improve their tutoring skills.

Rules:
- Start with 1-2 things they did WELL (specific, referencing what they actually said)
- Then 2-3 areas for improvement with CONCRETE advice (not vague)
- Be encouraging and constructive, never harsh
- Each tip should be 1-2 sentences max

BAD tip: "Work on your communication skills"
GOOD tip: "When explaining fractions, you jumped straight to the method. Try starting with a real-world example the kid can relate to — like sharing pizza slices equally."

BAD tip: "Be more patient"
GOOD tip: "When the student said 'I don't get it', you immediately re-explained. Try asking 'What part is confusing?' first — it helps you target the exact gap."

Respond ONLY with a valid JSON array, no markdown fences:
[{ "type": "strength", "text": "..." }, { "type": "tip", "text": "..." }]

Transcript:
{transcript}`;

/**
 * Generate coaching tips for the candidate based on their transcript.
 * Non-critical — if it fails, the interview still completes fine.
 */
export async function generateCoachingFeedback(
  transcript: TranscriptEntry[],
): Promise<CoachingTip[]> {
  const transcriptJson = JSON.stringify(transcript, null, 2);
  const prompt = COACHING_PROMPT.replace('{transcript}', transcriptJson);

  // Try Groq first (fast)
  const groq = getGroq();
  if (groq) {
    try {
      const result = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 1024,
      });
      const raw = result.choices[0]?.message?.content;
      if (raw) {
        const extracted = extractJson(raw);
        const tips = JSON.parse(extracted.startsWith('[') ? extracted : `[${extracted}]`) as CoachingTip[];
        return validateCoachingTips(tips);
      }
    } catch (err) {
      console.error('[Coaching] Groq failed:', err instanceof Error ? err.message : err);
    }
  }

  // Gemini fallback
  const genAI = getGenAI();
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
      });
      const result = await model.generateContent(prompt);
      const raw = result.response.text();
      if (raw) {
        const extracted = extractJson(raw);
        const tips = JSON.parse(extracted.startsWith('[') ? extracted : `[${extracted}]`) as CoachingTip[];
        return validateCoachingTips(tips);
      }
    } catch (err) {
      console.error('[Coaching] Gemini failed:', err instanceof Error ? err.message : err);
    }
  }

  console.error('[Coaching] All providers failed');
  return [];
}

function validateCoachingTips(tips: unknown[]): CoachingTip[] {
  if (!Array.isArray(tips)) return [];
  return tips
    .filter((t): t is CoachingTip =>
      typeof t === 'object' && t !== null &&
      ('type' in t) && ('text' in t) &&
      (t.type === 'strength' || t.type === 'tip') &&
      typeof t.text === 'string' && t.text.length > 5
    )
    .slice(0, 5); // cap at 5
}

export async function generateStrategicInsight(statsStr: string): Promise<string> {
  const prompt = `Based on these analytics from our tutor screening program, write a brief strategic recommendation for the hiring team. What should they change about their screening process, and what candidate profiles should they prioritize?

ANALYTICS SUMMARY:
${statsStr}

(Provide ONLY a single, insightful 1-paragraph summary, around 3-4 sentences. Do not use markdown headers or lists, keep it plain paragraph text.)`;
  
  const groq = getGroq();
  if (groq) {
    try {
      const response = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 300
      });
      if (response.choices[0]?.message?.content) {
        return response.choices[0].message.content.trim();
      }
    } catch(err) {
      console.warn('Groq failed for insight generation', err);
    }
  }
  
  const genAI = getGenAI();
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      const res = await model.generateContent(prompt);
      const text = res.response.text();
      if (text) return text.trim();
    } catch(err) {
      console.warn('Gemini failed for insight generation', err);
    }
  }

  return "Analytics aggregation indicates stable candidate variation across dimensions. Consider continuing to monitor teaching distributions and drop-offs to generate advanced strategic pivots.";
}
