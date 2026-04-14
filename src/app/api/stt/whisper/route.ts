// ============================================================================
// POST /api/stt/whisper — Server-side Whisper STT via Groq
// Receives an audio Blob, transcribes it via Groq's Whisper endpoint,
// and returns the text. Keeps the API key server-side.
// ============================================================================

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Whisper STT not configured (missing GROQ_API_KEY).' },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('file');

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: 'Missing audio file in request.' },
        { status: 400 },
      );
    }

    // Build the request to Groq's Whisper endpoint
    const groqFormData = new FormData();
    groqFormData.append('file', audioFile, 'audio.webm');
    groqFormData.append('model', 'whisper-large-v3-turbo');
    groqFormData.append('language', 'en');
    groqFormData.append('response_format', 'json');
    groqFormData.append('temperature', '0.0');

    // 8-second timeout via AbortController
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    const response = await fetch(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: groqFormData,
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(
        `[Whisper API] Groq returned ${response.status}:`,
        errorText.slice(0, 200),
      );

      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate limited', text: null },
          { status: 429 },
        );
      }

      return NextResponse.json(
        { error: `Whisper transcription failed: ${response.status}` },
        { status: 502 },
      );
    }

    const result = await response.json();

    return NextResponse.json({
      text: result.text || '',
      language: result.language || 'en',
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[Whisper API] Request timed out.');
      return NextResponse.json(
        { error: 'Whisper transcription timed out', text: null },
        { status: 504 },
      );
    }

    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Whisper API] Error:', msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 },
    );
  }
}
