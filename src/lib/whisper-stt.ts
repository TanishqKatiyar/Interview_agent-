// ============================================================================
// Cuemath AI Tutor Screener — Whisper STT Client
// Sends audio blobs to our server-side Whisper endpoint for accurate
// transcription. Used alongside Web Speech API in hybrid mode.
// ============================================================================

import { postProcessSTT } from './stt-postprocess';

/**
 * Client for server-side Whisper transcription via `/api/stt/whisper`.
 * All API key handling is done server-side to avoid exposure.
 */
export default class WhisperSTT {
  private _available = true;

  /**
   * Transcribe an audio Blob via Groq Whisper (server-side).
   * Returns null on any error (timeout, rate-limit, network) so the
   * caller can gracefully fall back to Web Speech API.
   */
  async transcribe(
    audioBlob: Blob,
  ): Promise<{ text: string; language: string } | null> {
    if (!this._available) return null;

    // Skip tiny blobs (usually silence / noise)
    if (audioBlob.size < 5_000) {
      console.debug('[WhisperSTT] Blob too small, skipping:', audioBlob.size);
      return null;
    }

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');

      const response = await fetch('/api/stt/whisper', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('[WhisperSTT] Rate limited — falling back to Web Speech.');
        } else if (response.status === 504) {
          console.warn('[WhisperSTT] Timed out — falling back to Web Speech.');
        } else {
          console.error(`[WhisperSTT] Error ${response.status}`);
        }
        return null;
      }

      const result = await response.json();
      if (!result.text || !result.text.trim()) {
        return null;
      }

      // Apply the same post-processing corrections
      const corrected = postProcessSTT(result.text);

      return {
        text: corrected,
        language: result.language || 'en',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[WhisperSTT] Request failed:', msg);
      return null;
    }
  }

  /** Check if the whisper endpoint is available. */
  get isAvailable(): boolean {
    return this._available;
  }

  /** Disable Whisper (e.g., after repeated failures). */
  disable(): void {
    console.warn('[WhisperSTT] Disabled — using Web Speech API only.');
    this._available = false;
  }
}
