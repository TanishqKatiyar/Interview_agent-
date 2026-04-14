// ============================================================================
// Cuemath AI Tutor Screener — STT API Route (Deepgram Nova-3)
// Pre-recorded transcription via Deepgram's REST API.
// Receives a FormData audio blob, sends to Deepgram, returns transcript.
// ============================================================================

import { DeepgramClient } from '@deepgram/sdk';
import { sttLimiter } from '@/lib/rate-limiter';
import { logInfo, logError } from '@/lib/logger';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { allowed, retryAfterMs } = sttLimiter.check(ip, 30, 60 * 1000);

  if (!allowed) {
    return Response.json(
      { text: '', confidence: 0, error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }

  const startTime = Date.now();

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    // ── Validate audio ──────────────────────────────────────────────────────
    if (!audioFile || audioFile.size < 1000) {
      return Response.json(
        { text: '', confidence: 0, error: 'Audio too short or missing' },
        { status: 400 },
      );
    }

    if (audioFile.size > 25 * 1024 * 1024) {
      return Response.json(
        { text: '', confidence: 0, error: 'Audio file too large (max 25MB)' },
        { status: 400 },
      );
    }

    // ── Deepgram client ─────────────────────────────────────────────────────
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error('[STT] DEEPGRAM_API_KEY not set');
      return Response.json(
        { text: '', confidence: 0, error: 'STT service not configured' },
        { status: 500 },
      );
    }

    const deepgram = new DeepgramClient({ apiKey });
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    // ── Transcribe ──────────────────────────────────────────────────────────
    const result = await deepgram.listen.v1.media.transcribeFile(audioBuffer, {
      model: 'nova-3',
      language: 'en',
      smart_format: true,
      punctuate: true,
      filler_words: false,
      diarize: false,
      detect_language: false,
    });

    // ── Extract transcript ──────────────────────────────────────────────────
    // Response is ListenV1Response | ListenV1AcceptedResponse — narrow to the one with results
    const transcript =
      result && 'results' in result
        ? result.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
        : '';
    const confidence =
      result && 'results' in result
        ? result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0
        : 0;
    const latency = Date.now() - startTime;

    console.log(
      `[STT] Deepgram: "${transcript.slice(0, 80)}${transcript.length > 80 ? '...' : ''}" (${(confidence * 100).toFixed(0)}%, ${latency}ms)`,
    );

    logInfo('stt', 'Deepgram transcription', {
      latency_ms: latency,
      text_length: transcript.length,
      confidence: Math.round(confidence * 100),
      audio_size: audioFile.size,
    });

    return Response.json({
      text: transcript,
      confidence,
      latency,
      provider: 'deepgram',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[STT] Deepgram failed:', message);

    logError('stt', 'Deepgram transcription failed', {
      error: message,
      latency_ms: Date.now() - startTime,
    });

    return Response.json(
      { text: '', confidence: 0, error: message },
      { status: 500 },
    );
  }
}
