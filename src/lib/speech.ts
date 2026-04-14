// ============================================================================
// Cuemath AI Tutor Screener — Voice Manager (Deepgram-powered)
// Handles TTS (Edge TTS), STT (Deepgram via /api/stt), audio visualization,
// and full interview recording. Push-to-talk model — no streaming STT needed.
//
// STT flow: startListening() → MediaRecorder captures audio
//           stopListening()  → sends Blob to /api/stt → returns transcript
// ============================================================================

import EdgeTTSClient from './edge-tts-client';

export default class VoiceManager {
  // ── Audio Core ──
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  // ── STT (MediaRecorder → Deepgram) ──
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private _isListening = false;

  // ── TTS (Edge TTS) ──
  private edgeTts: EdgeTTSClient;

  // ── Full Interview Recording ──
  private fullRecorder: MediaRecorder | null = null;
  private fullChunks: Blob[] = [];

  constructor() {
    this.edgeTts = new EdgeTTSClient();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════

  async init(): Promise<{ success: boolean; error?: string }> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      // Setup AudioContext + Analyser for mic level visualization
      const ACClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new ACClass();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);

      return { success: true };
    } catch (err) {
      console.error('[VoiceManager] Init failed:', err);
      return {
        success: false,
        error: (err as Error).message || 'Microphone access denied',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEAKING (Edge TTS)
  // ═══════════════════════════════════════════════════════════════════════════

  async speak(text: string): Promise<void> {
    return this.edgeTts.speakStreaming(text);
  }

  stopSpeaking(): void {
    this.edgeTts.stop();
  }

  get isSpeaking(): boolean {
    return this.edgeTts.isSpeaking;
  }

  /** Expose for pre-generated greeting playback */
  get ttsClient(): EdgeTTSClient {
    return this.edgeTts;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LISTENING (MediaRecorder → Deepgram via /api/stt)
  // ═══════════════════════════════════════════════════════════════════════════

  startListening(): void {
    if (!this.mediaStream || this._isListening) return;

    this.audioChunks = [];
    this._isListening = true;

    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
      mimeType: this.getBestMimeType(),
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.audioChunks.push(event.data);
    };

    this.mediaRecorder.start(250); // collect data every 250ms
  }

  async stopListening(): Promise<{ transcript: string; confidence: number }> {
    this._isListening = false;

    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve({ transcript: '', confidence: 0 });
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, {
          type: this.getBestMimeType(),
        });
        this.audioChunks = [];

        // Too short — accidental tap or silence
        if (audioBlob.size < 3000) {
          resolve({ transcript: '', confidence: 0 });
          return;
        }

        // Send to Deepgram via our API route
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          const response = await fetch('/api/stt', {
            method: 'POST',
            body: formData,
          });

          const result = await response.json();

          resolve({
            transcript: result.text || '',
            confidence: result.confidence || 0,
          });
        } catch (error) {
          console.error('[VoiceManager] STT failed:', error);
          resolve({ transcript: '', confidence: 0 });
        }
      };

      this.mediaRecorder.stop();
    });
  }

  get isListening(): boolean {
    return this._isListening;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIO LEVEL (for visualizer)
  // ═══════════════════════════════════════════════════════════════════════════

  getAudioLevel(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
    return Math.min(avg / 128, 1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL INTERVIEW RECORDING
  // ═══════════════════════════════════════════════════════════════════════════

  startRecording(): void {
    if (!this.mediaStream) return;
    this.fullChunks = [];
    this.fullRecorder = new MediaRecorder(this.mediaStream, {
      mimeType: this.getBestMimeType(),
    });
    this.fullRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.fullChunks.push(e.data);
    };
    this.fullRecorder.start(1000);
  }

  get isRecording(): boolean {
    return this.fullRecorder?.state === 'recording';
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.fullRecorder || this.fullRecorder.state === 'inactive') {
        resolve(new Blob([], { type: 'audio/webm' }));
        return;
      }
      this.fullRecorder.onstop = () => {
        resolve(new Blob(this.fullChunks, { type: this.getBestMimeType() }));
        this.fullChunks = [];
      };
      this.fullRecorder.stop();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPLOAD
  // ═══════════════════════════════════════════════════════════════════════════

  async uploadRecording(
    interviewId: string,
    blob: Blob,
  ): Promise<string | null> {
    try {
      const { supabase } = await import('./supabase');
      const filePath = `${interviewId}/${Date.now()}.webm`;

      const { error } = await supabase.storage
        .from('recordings')
        .upload(filePath, blob, {
          contentType: 'audio/webm',
          upsert: false,
        });

      if (error) {
        console.error('[VoiceManager] Upload error:', error.message);
        return null;
      }

      const { data } = supabase.storage
        .from('recordings')
        .getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      console.error('[VoiceManager] Upload failed:', err);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  private getBestMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg',
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  destroy(): void {
    this.stopSpeaking();

    // Stop STT recorder
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    } catch { /* ignore */ }

    // Stop full recording
    try {
      if (this.fullRecorder && this.fullRecorder.state !== 'inactive') {
        this.fullRecorder.stop();
      }
    } catch { /* ignore */ }

    // Release mic
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.edgeTts.destroy();
  }
}
