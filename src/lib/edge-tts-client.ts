// ============================================================================
// Cuemath AI Tutor Screener — Edge TTS Client
// Client-side class that calls /api/tts to generate audio, then plays it.
//
// COLD-START FIX: Use playPregenerated(blob) to immediately play audio that
// was fetched during mic setup (no wait for first TTS call).
//
// GAP FIX: Text < 2500 chars → single audio file, zero sentence gaps.
//          Text ≥ 2500 chars → parallel generation, sequential playback.
// (Interview turns are almost always < 2500 chars, so we get one continuous
// utterance from Nisha — no robotic 1–2s breaks at full stops.)
// ============================================================================

export default class EdgeTTSClient {
  // ── Playback ──
  private audio!: HTMLAudioElement;
  private blobUrls: string[] = [];
  private abortController: AbortController | null = null;
  private _isSpeaking = false;

  constructor() {
    // SSR guard — `Audio` only exists in the browser.
    if (typeof window === 'undefined') return;
    this.audio = new Audio();
    this.audio.preload = 'auto';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // playPregenerated — Play a pre-fetched audio Blob immediately
  // Used for the greeting: audio is fetched during mic setup to bypass cold start.
  // ═══════════════════════════════════════════════════════════════════════════

  async playPregenerated(blob: Blob): Promise<void> {
    this.stop();
    this._isSpeaking = true;
    try {
      await this.playBlob(blob);
    } finally {
      this._isSpeaking = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // speakStreaming — Primary TTS entry point
  //
  // < 2500 chars → ONE audio file, zero sentence gaps
  // ≥ 2500 chars → parallel generation, sequential playback
  // ═══════════════════════════════════════════════════════════════════════════

  async speakStreaming(text: string): Promise<void> {
    this.stop();
    this._isSpeaking = true;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    try {
      if (text.length < 2500) {
        // ── Short/medium text: single request, zero gaps ──
        const blob = await this.generateAudio(text, signal);
        if (blob && !signal.aborted) await this.playBlob(blob);
        return;
      }

      // ── Long text: split, generate all in parallel, play sequentially ──
      const sentences: string[] =
        text.match(/[^.!?]+[.!?]+[\s]?|[^.!?]+$/g)
          ?.map((s) => s.trim())
          .filter((s) => s.length > 0) ?? [text];

      // Kick off all network requests immediately (parallel)
      const blobPromises = sentences.map((s) => this.generateAudio(s, signal));

      for (let i = 0; i < sentences.length; i++) {
        if (signal.aborted) break;
        const blob = await blobPromises[i];
        if (blob && !signal.aborted) await this.playBlob(blob);
      }
    } finally {
      this._isSpeaking = false;
      this.abortController = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // stop — Cancel in-flight requests and stop playback
  // ═══════════════════════════════════════════════════════════════════════════

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    try {
      this.audio.pause();
      this.audio.currentTime = 0;
    } catch { /* ignore */ }
    this._isSpeaking = false;
    this.cleanupBlobUrls();
  }

  get isSpeaking(): boolean {
    return this._isSpeaking;
  }

  destroy(): void {
    this.stop();
    this.audio.removeAttribute('src');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private: generateAudio — Fetch from /api/tts, return Blob or null
  // ═══════════════════════════════════════════════════════════════════════════

  private async generateAudio(
    text: string,
    signal?: AbortSignal,
  ): Promise<Blob | null> {
    try {
      const isSSML = text.trimStart().startsWith('<speak');
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: 'en-US-AvaMultilingualNeural',
          ...(isSSML && { ssml: true }),
        }),
        signal,
      });

      if (!response.ok) {
        console.error(`[EdgeTTSClient] API error ${response.status}`);
        return null;
      }

      const blob = await response.blob();
      if (blob.size < 100) {
        console.warn(`[EdgeTTSClient] Audio too small (${blob.size}B) — skipping`);
        return null;
      }
      return blob;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return null;
      console.error('[EdgeTTSClient] Fetch failed:', err);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private: playBlob — Play audio Blob, resolve when finished
  // ═══════════════════════════════════════════════════════════════════════════

  private playBlob(blob: Blob): Promise<void> {
    return new Promise<void>((resolve) => {
      if (blob.size < 100) {
        console.warn(`[EdgeTTSClient] Blob too small (${blob.size}B) — skipping`);
        resolve();
        return;
      }

      // Revoke previous blob URL
      if (this.audio.src?.startsWith('blob:')) {
        URL.revokeObjectURL(this.audio.src);
        this.blobUrls = this.blobUrls.filter((u) => u !== this.audio.src);
      }

      const url = URL.createObjectURL(blob);
      this.blobUrls.push(url);
      this.audio.src = url;

      const cleanup = (done: () => void) => {
        this.audio.removeEventListener('ended', onEnded);
        this.audio.removeEventListener('error', onError);
        done();
      };

      const onEnded = () => cleanup(resolve);
      const onError = (e: Event) => {
        console.error('[EdgeTTSClient] Playback error:', e);
        cleanup(resolve); // resolve anyway to unblock chain
      };

      this.audio.addEventListener('ended', onEnded, { once: true });
      this.audio.addEventListener('error', onError, { once: true });

      this.audio.play().catch((err) => {
        console.error('[EdgeTTSClient] play() failed:', err);
        cleanup(resolve);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private: cleanupBlobUrls
  // ═══════════════════════════════════════════════════════════════════════════

  private cleanupBlobUrls(): void {
    for (const url of this.blobUrls) URL.revokeObjectURL(url);
    this.blobUrls = [];
  }
}
