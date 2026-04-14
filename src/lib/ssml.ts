// ============================================================================
// Cuemath AI Tutor Screener — SSML Generation
//
// Converts plain text + speech context into SSML markup that the free Edge TTS
// (Read Aloud) endpoint understands. The free endpoint supports only basic SSML:
//
//   ✅ <prosody rate/pitch/volume>  — Works
//   ❌ <mstts:express-as>           — Azure-only, silently fails
//   ❌ <break time="..."/>          — Silently fails on free endpoint
//
// So we achieve vocal *feel* purely through rate/pitch/volume adjustments:
//   warm   = slightly slower, slightly higher pitch, louder
//   calm   = slower, lower pitch, softer
//   upbeat = faster, higher pitch
// ============================================================================

export type SpeechContext =
  | 'greeting'
  | 'question'
  | 'followup'
  | 'encouragement'
  | 'closing';

// ── Context-specific prosody presets ─────────────────────────────────────────

interface ProsodyPreset {
  rate: string;   // e.g. "-8%", "+5%"
  pitch: string;  // e.g. "+2%", "-1%"
  volume: string; // e.g. "+10%", "+0%"
}

const PROSODY_MAP: Record<SpeechContext, ProsodyPreset> = {
  greeting: {
    rate: '+5%',     // Warm but conversational — real people speak briskly
    pitch: '+3%',    // Slightly brighter
    volume: '+5%',   // Confident
  },
  question: {
    rate: '+8%',     // Natural, engaged — closer to real speech tempo
    pitch: '+1%',    // Slight upward inflection
    volume: '+0%',
  },
  followup: {
    rate: '+10%',    // Quick back-and-forth, like a real chat
    pitch: '+2%',    // Interested
    volume: '+0%',
  },
  encouragement: {
    rate: '+4%',     // Warm and supportive without dragging
    pitch: '+4%',    // Uplifting
    volume: '+5%',   // Confident, supportive
  },
  closing: {
    rate: '+0%',     // Genuine, unhurried but not slow
    pitch: '-1%',    // Gentle downturn
    volume: '+0%',
  },
};

// ── XML escape ──────────────────────────────────────────────────────────────

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Main SSML generator ─────────────────────────────────────────────────────

/**
 * Wrap text in SSML markup with context-appropriate prosody adjustments.
 *
 * Uses only features supported by the free Edge TTS (Read Aloud) endpoint:
 * - <prosody rate/pitch/volume>
 *
 * Does NOT use (unsupported on free endpoint):
 * - <mstts:express-as> (Azure Speech Service only)
 * - <break time="..."/>  (silently rejected)
 *
 * @param text    - Plain text to speak
 * @param voice   - Edge TTS voice name (e.g. "en-US-JennyNeural")
 * @param context - Speech context controlling prosody
 * @returns       - Complete SSML string ready for Edge TTS WebSocket
 */
export function textToSSML(
  text: string,
  voice: string,
  context: SpeechContext,
): string {
  const { rate, pitch, volume } = PROSODY_MAP[context];

  const escaped = escapeXml(text);

  return [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">',
    `  <voice name="${voice}">`,
    `    <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">`,
    `      ${escaped}`,
    '    </prosody>',
    '  </voice>',
    '</speak>',
  ].join('\n');
}
