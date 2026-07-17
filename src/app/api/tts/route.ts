// ============================================================================
// POST /api/tts — Server-side Edge TTS (Microsoft Neural Voices)
//
// Available voices:
//   en-US-JennyNeural        (DEFAULT — warm, professional woman)
//   en-US-AriaNeural         (versatile, slightly energetic)
//   en-US-SaraNeural         (calm, reassuring)
//   en-US-EmmaMultilingualNeural (very natural, multilingual)
//   en-IN-NeerjaNeural       (Indian English female — good for relatability)
//
// Usage:
//   Plain text:  POST { text: string, voice?: string, rate?: string }
//   SSML input:  POST { text: "<speak ...>...</speak>", ssml?: true }
//
// Returns: audio/mpeg binary
// ============================================================================

import { NextResponse } from 'next/server';
import { EdgeTTS } from '@andresaya/edge-tts';
import WebSocket from 'ws';
import { Buffer } from 'buffer';
import { ttsLimiter } from '@/lib/rate-limiter';
import { sanitizeText } from '@/lib/sanitize';
import { logInfo, logError } from '@/lib/logger';

// ── Constants (mirrored from @andresaya/edge-tts internals) ─────────────────

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const VERSION_MS_GEC = '1-143.0.3650';

function getBaseHeaders(): Record<string, string> {
  const token32 = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'en-US,en;q=0.9',
    Cookie: 'MUID=' + token32,
  };
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-xxxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    },
  );
}

function nowRFC1123(): string {
  return new Date().toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

async function generateSecMsGec(trustedClientToken: string): Promise<string> {
  const now = nowRFC1123();
  const fixedDate = new Date(now);
  const ticks = Math.floor(fixedDate.getTime() / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  const windowsTicks = rounded * 10_000_000;
  const encoder = new TextEncoder();
  const data = encoder.encode(`${windowsTicks}${trustedClientToken}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

// ── Raw SSML synthesis (bypasses the library's getSSML) ─────────────────────

async function synthesizeSSML(
  ssml: string,
  outputFormat = 'audio-24khz-96kbitrate-mono-mp3',
): Promise<Buffer> {
  const secMsGEC = await generateSecMsGec(TRUSTED_CLIENT_TOKEN);
  const reqId = generateUUID();
  const url = `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=${VERSION_MS_GEC}&ConnectionId=${reqId}`;

  return new Promise<Buffer>((resolve, reject) => {
    const audioChunks: Uint8Array[] = [];
    const ws = new WebSocket(url, {
      headers: getBaseHeaders(),
      rejectUnauthorized: false,
    });

    let timedOut = false;
    let inactivityTimeout: ReturnType<typeof setTimeout>;

    const resetTimeout = () => {
      clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(() => {
        timedOut = true;
        if (ws.readyState === WebSocket.OPEN) ws.close();
        reject(new Error('SSML WebSocket inactivity timeout'));
      }, 15_000);
    };

    ws.on('open', () => {
      resetTimeout();

      // Send configuration
      const configMsg =
        `X-Timestamp:${nowRFC1123()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":true},"outputFormat":"${outputFormat}"}}}}`;
      ws.send(configMsg);

      // Send SSML directly (no library wrapping)
      const speechMsg = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${nowRFC1123()}\r\nPath:ssml\r\n\r\n${ssml}`;
      ws.send(speechMsg);
    });

    ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      resetTimeout();
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      const needle = Buffer.from('Path:audio\r\n');
      const idx = buffer.indexOf(new Uint8Array(needle));
      if (idx !== -1) {
        audioChunks.push(new Uint8Array(buffer.subarray(idx + needle.length)));
      }
      if (buffer.toString().includes('Path:turn.end')) {
        ws.close();
      }
    });

    ws.on('error', (err) => {
      clearTimeout(inactivityTimeout);
      if (ws.readyState === WebSocket.OPEN) ws.close();
      reject(err);
    });

    ws.on('close', () => {
      clearTimeout(inactivityTimeout);
      if (timedOut) return; // Already rejected
      resolve(Buffer.concat(audioChunks));
    });
  });
}

// ── Detect if text is SSML ──────────────────────────────────────────────────

function isSSML(text: string, ssmlFlag?: boolean): boolean {
  return ssmlFlag === true || text.trimStart().startsWith('<speak');
}

const ttsCache = new Map<string, Buffer>();
const MAX_CACHE_SIZE = 150;

function getCacheKey(text: string, voice: string): string {
  // Simple string hash to avoid collisions with long texts sharing a prefix
  const input = text + '|' + voice;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0) * 0x100000000 + (h1 >>> 0)).toString(36);
}

// ═════════════════════════════════════════════════════════════════════════════
// POST handler
// ═════════════════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  const start = Date.now();

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { allowed, retryAfterMs } = ttsLimiter.check(ip, 100, 60 * 1000);
  
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  try {
    const body = await request.json();
    let { text, voice, rate, ssml: ssmlFlag } = body as {
      text?: string;
      voice?: string;
      rate?: string;
      ssml?: boolean;
    };

    // SSML payloads can be longer than plain text due to markup
    const maxLen = isSSML(text || '', ssmlFlag) ? 3000 : 2500;
    text = sanitizeText(text || '', maxLen);

    // Replace full stops with commas to eliminate robotic pauses if not using SSML
    if (text && !isSSML(text, ssmlFlag)) {
      text = text.replace(/\.\s/g, ', ').replace(/\.$/g, '');
    }

    // ── Validation ──
    if (!text || text.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty "text" field.' },
        { status: 400 },
      );
    }
    // (sanitizeText already caps text at maxLen above)
    
    // ── Caching Logic ──
    const selectedVoice = voice || process.env.TTS_VOICE || 'en-IN-NeerjaNeural';
    const cacheKey = getCacheKey(text, selectedVoice);

    if (ttsCache.has(cacheKey)) {
      const cachedBuffer = ttsCache.get(cacheKey)!;
      const ms = Date.now() - start;
      const audioBytes = new Uint8Array(cachedBuffer);
      logInfo('tts', 'TTS generated', { text_length: text.length, latency_ms: ms, cache_hit: true });
      console.log(
        `[TTS] CACHE HIT ${text.length} chars in ${ms}ms (${isSSML(text, ssmlFlag) ? 'SSML' : 'plain'}, ${audioBytes.length} bytes)`,
      );

      return new Response(audioBytes, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(audioBytes.length),
          'Cache-Control': 'public, max-age=86400', // Browser can cache too
        },
      });
    }

    // ── Synthesis ──
    let audioBuffer: Buffer;

    if (isSSML(text, ssmlFlag)) {
      // ── SSML mode: bypass library, send raw SSML to WebSocket ──
      console.log(
        `[TTS] SSML synthesis (${text.length} chars)…`,
      );
      audioBuffer = await Promise.race([
        synthesizeSSML(text),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TTS_TIMEOUT')), 8_000),
        ),
      ]);
    } else {
      // ── Plain text mode: use library as before ──
      const tts = new EdgeTTS();
      await tts.synthesize(text, selectedVoice, {
        rate: rate || '+2%', // slight adjustment without making it too fast
        volume: '+0%',
        pitch: '+0Hz', // remove artificial pitch to avoid distortion
        outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
      });

      audioBuffer = await Promise.race([
        tts.toBuffer(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TTS_TIMEOUT')), 5_000),
        ),
      ]);
    }

    const ms = Date.now() - start;
    const audioBytes = new Uint8Array(audioBuffer);
    console.log(
      `[TTS] Generated in ${ms}ms (${isSSML(text, ssmlFlag) ? 'SSML' : 'plain'}, ${text.length} chars, ${audioBytes.length} bytes)`,
    );
    logInfo('tts', 'TTS generated', { text_length: text.length, latency_ms: ms, cache_hit: false });

    // Guard: if synthesis produced no audio data, return an error
    if (audioBytes.length === 0) {
      console.error('[TTS] Synthesis returned 0 bytes — SSML may have been rejected by the service.');
      return NextResponse.json(
        { error: 'TTS synthesis produced no audio. The SSML may be malformed.' },
        { status: 502 },
      );
    }
    
    // ── Store in Cache (evict oldest when full) ──
    if (ttsCache.size >= MAX_CACHE_SIZE) {
      const firstKey = ttsCache.keys().next().value;
      if (firstKey) ttsCache.delete(firstKey);
    }
    ttsCache.set(cacheKey, audioBuffer);

    return new Response(audioBytes, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBytes.length),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'TTS_TIMEOUT') {
      console.error('[TTS] Synthesis timed out.');
      return NextResponse.json(
        { error: 'TTS synthesis timed out. Try shorter text.' },
        { status: 503 },
      );
    }
    console.error('[TTS] Synthesis error:', msg);
    logError('tts', 'TTS generation failed', { error: msg, text_length: 0 });
    return NextResponse.json(
      { error: `TTS synthesis failed: ${msg}` },
      { status: 500 },
    );
  }
}

