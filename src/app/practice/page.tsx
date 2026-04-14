'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Square, Loader2, Check, Volume2, ShieldCheck, ArrowRight, ArrowLeft, X } from 'lucide-react';

import VoiceManager from '@/lib/speech';
import EdgeTTSClient from '@/lib/edge-tts-client';
import { PracticeEngine } from '@/lib/practice-engine';

// ─── Setup Sub-component ──────────────────────────────────────────────────
function SetupStatusRow({
  label,
  idx,
  ready,
  failed,
}: {
  label: string;
  idx: string;
  ready: boolean;
  failed?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-ink/10 last:border-b-0">
      <span className="font-mono text-[10px] tnum tracking-[0.18em] text-ink-soft w-8">
        {idx}
      </span>
      <div
        className={
          'w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ' +
          (ready
            ? 'bg-accent border-accent'
            : failed
              ? 'bg-tangerine border-tangerine'
              : 'bg-transparent border-ink/25')
        }
      >
        {ready && <Check className="w-3 h-3 text-paper" strokeWidth={3} />}
        {failed && <X className="w-3 h-3 text-paper" strokeWidth={3} />}
      </div>
      <span
        className={
          'font-display text-[15px] tracking-[-0.01em] flex-1 ' +
          (ready ? 'text-ink' : failed ? 'text-tangerine' : 'text-ink-muted')
        }
      >
        {label}
      </span>
      <span
        className={
          'font-mono text-[9px] uppercase tracking-[0.22em] ' +
          (ready ? 'text-accent' : failed ? 'text-tangerine' : 'text-ink-soft')
        }
      >
        {ready ? 'ready' : failed ? 'failed' : 'checking'}
      </span>
    </div>
  );
}

// ─── Main Practice Page Component ──────────────────────────────────────────
export default function PracticePage() {
  const [screenState, setScreenState] = useState<'START' | 'SETUP' | 'INTERVIEW' | 'DONE'>('START');
  const [micState, setMicState] = useState<'AI_SPEAKING' | 'PREPARING' | 'RECORDING' | 'PROCESSING'>('PREPARING');

  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [micReady, setMicReady] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [llmReady, setLlmReady] = useState(false);
  const [greetingBlob, setGreetingBlob] = useState<Blob | null>(null);

  const [audioLevel, setAudioLevel] = useState(0);

  const engineRef = useRef<PracticeEngine | null>(null);
  const voiceRef = useRef<VoiceManager | null>(null);

  // Auto clean up
  useEffect(() => {
    return () => {
      edgeTTS.destroy();
      if (voiceRef.current) {
        voiceRef.current.destroy();
      }
    };
  }, []);

  const edgeTTS = useRef(new EdgeTTSClient()).current;

  // ─── Setup Flow ───
  const beginSetup = async () => {
    setScreenState('SETUP');
    setSetupLoading(true);
    setSetupError(null);

    engineRef.current = new PracticeEngine();
    voiceRef.current = new VoiceManager();

    try {
      const { success, error } = await voiceRef.current.init();
      if (!success) throw new Error(error || 'Microphone permission denied. We need this to hear your brilliant answers.');
      setMicReady(true);

      const ttsRes = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: "Hi, I'm Nisha! Thanks for trying our practice round. Let's do a quick warm-up. Tell me a little bit about yourself and why you're interested in tutoring.",
          voice: 'en-US-AvaMultilingualNeural',
        }),
      });
      if (!ttsRes.ok) throw new Error('Failed to initialize voice interface.');
      const blob = await ttsRes.blob();
      setGreetingBlob(blob);
      setLlmReady(true);
      setVoiceReady(true);

      setSetupLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong during setup.';
      setSetupError(msg);
      setSetupLoading(false);
    }
  };

  const startInterview = async () => {
    setScreenState('INTERVIEW');
    setMicState('AI_SPEAKING');

    engineRef.current!.addEntry('ai', "Hi, I'm Nisha! Thanks for trying our practice round. Let's do a quick warm-up. Tell me a little bit about yourself and why you're interested in tutoring.");

    if (greetingBlob) {
      await edgeTTS.playPregenerated(greetingBlob);
    }

    setMicState('RECORDING');
    startRecording();
  };

  const startRecording = useCallback(async () => {
    if (!voiceRef.current) return;
    try {
      voiceRef.current.startListening();
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }, []);

  useEffect(() => {
    if (micState !== 'RECORDING' || !voiceRef.current) return;
    const interval = setInterval(() => {
      setAudioLevel(voiceRef.current!.getAudioLevel());
    }, 50);
    return () => clearInterval(interval);
  }, [micState]);

  const stopRecordingAndProcess = useCallback(async () => {
    if (!voiceRef.current || !engineRef.current) return;

    setMicState('PROCESSING');

    try {
      const { transcript, confidence } = await voiceRef.current.stopListening();

      const candidateText = transcript && confidence > 0.4 ? transcript : '(Audio unclear)';

      engineRef.current.addEntry('candidate', candidateText);

      if (engineRef.current.isEnded()) {
        setScreenState('DONE');
        return;
      }

      setMicState('AI_SPEAKING');

      const res = await fetch('/api/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: engineRef.current.getTranscript() }),
      });

      if (!res.ok) throw new Error('Failed to get practice response');
      const { text } = await res.json();

      engineRef.current.addEntry('ai', text);
      await edgeTTS.speakStreaming(text);

      if (engineRef.current.isEnded()) {
        setScreenState('DONE');
        return;
      }

      setMicState('PREPARING');
      setTimeout(() => {
        setMicState('RECORDING');
        startRecording();
      }, 500);
    } catch (err) {
      console.error('Pipeline error:', err);
      setMicState('RECORDING');
      startRecording();
    }
  }, [startRecording, edgeTTS]);

  // ═══════════════════════════════════════════════════════════════════════════
  // START SCREEN — editorial intro
  // ═══════════════════════════════════════════════════════════════════════════
  if (screenState === 'START') {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col">
        {/* Top editorial bar */}
        <header className="border-b border-ink/15 bg-paper-deep/40">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft hover:text-ink transition"
            >
              <ArrowLeft className="w-3 h-3" strokeWidth={2} />
              Back
            </Link>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Practice · Unscored
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft tnum hidden sm:inline">
              #PRAC-2026
            </span>
          </div>
        </header>

        {/* Hero */}
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-8 py-12 sm:py-20 grid grid-cols-12 gap-6">
          {/* Left rail — taxonomy */}
          <aside className="hidden lg:block col-span-2 pt-2">
            <div className="sticky top-8 space-y-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2">
                  / Category
                </div>
                <div className="font-display text-[15px] text-ink leading-tight">
                  Warm-up round
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2">
                  / Duration
                </div>
                <div className="font-display text-[15px] text-ink leading-tight">
                  ~2 min
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2">
                  / Saved
                </div>
                <div className="font-display text-[15px] text-ink leading-tight">
                  Never
                </div>
              </div>
            </div>
          </aside>

          {/* Right — headline + brief */}
          <div className="col-span-12 lg:col-span-10">
            <div className="flex items-center gap-2 mb-6">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent text-paper font-mono text-[10px] uppercase tracking-[0.22em]">
                <ShieldCheck className="w-3 h-3" strokeWidth={2.5} />
                Practice Mode
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
                · Private · Un-scored
              </span>
            </div>

            <h1
              className="font-display font-extrabold tracking-[-0.04em] text-ink"
              style={{ fontSize: 'clamp(56px, 11vw, 168px)', lineHeight: 0.86 }}
            >
              Warm-up.
            </h1>

            <div className="mt-8 max-w-[720px] grid grid-cols-12 gap-6">
              <div className="col-span-12 md:col-span-4 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft pt-2">
                / Note 01
              </div>
              <p className="col-span-12 md:col-span-8 font-display text-[19px] sm:text-[22px] leading-[1.4] text-ink-muted tracking-[-0.01em]">
                Two quick questions so you can hear Nisha, test your mic, and shake off first-round jitters. Nothing is recorded. Nothing is scored.
              </p>
            </div>

            <div className="mt-12 flex flex-col sm:flex-row items-start gap-4">
              <button
                onClick={beginSetup}
                className="group inline-flex items-center gap-3 pl-6 pr-2 py-2 rounded-full bg-accent text-paper font-display font-semibold text-[17px] tracking-[-0.01em] hover:bg-accent-deep transition"
              >
                Start warm-up
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-paper text-accent group-hover:translate-x-1 transition">
                  <ArrowRight className="w-4 h-4" strokeWidth={2.2} />
                </span>
              </button>
              <Link
                href="/interview"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-ink/20 text-ink font-display font-semibold text-[15px] hover:bg-ink hover:text-paper transition"
              >
                Skip to real interview
              </Link>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-ink/15 bg-paper-deep/40">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
            <span>Cuemath · Tutor Screener</span>
            <span className="tnum">v1.0 · 2026</span>
          </div>
        </footer>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SETUP SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (screenState === 'SETUP') {
    return (
      <div className="min-h-screen bg-paper text-ink flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[520px]">
          <div className="flex items-center gap-2 mb-6 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Pre-flight · 01 / 03
          </div>

          <h2
            className="font-display font-extrabold tracking-[-0.03em] text-ink mb-8"
            style={{ fontSize: 'clamp(36px, 6vw, 56px)', lineHeight: 0.92 }}
          >
            Checking setup.
          </h2>

          <div className="border border-ink/15 rounded-[4px] p-5 bg-paper-deep/40 mb-6">
            <SetupStatusRow idx="01" label="Microphone access" ready={micReady} failed={!!setupError && !micReady} />
            <SetupStatusRow idx="02" label="AI server connection" ready={llmReady} failed={!!setupError && !llmReady} />
            <SetupStatusRow idx="03" label="Audio rendering" ready={voiceReady} failed={!!setupError && !voiceReady} />
          </div>

          {setupError ? (
            <div className="border-l-[3px] border-tangerine bg-tangerine/10 px-4 py-3 rounded-[4px]">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-tangerine mb-1">
                Error
              </div>
              <p className="font-display text-[15px] text-ink">{setupError}</p>
            </div>
          ) : setupLoading ? (
            <div className="flex items-center justify-center gap-3 py-4">
              <Loader2 className="w-5 h-5 text-accent animate-spin" />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                Warming up…
              </span>
            </div>
          ) : (
            <button
              onClick={startInterview}
              className="group w-full inline-flex items-center justify-center gap-3 px-6 py-4 rounded-full bg-accent text-paper font-display font-semibold text-[17px] tracking-[-0.01em] hover:bg-accent-deep transition"
            >
              Ready — let&apos;s start
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERVIEW (LIVE) — warm visualizer
  // ═══════════════════════════════════════════════════════════════════════════
  if (screenState === 'INTERVIEW') {
    const ringRadius = 40 + audioLevel * 1.5;
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col overflow-hidden relative">
        {/* Top taxonomy strip */}
        <header className="absolute top-0 left-0 right-0 z-10 border-b border-ink/10 bg-paper/80 backdrop-blur">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
              Practice · Live
            </span>
            <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              {micState === 'AI_SPEAKING'
                ? 'Nisha speaking'
                : micState === 'RECORDING'
                  ? 'Listening'
                  : micState === 'PROCESSING'
                    ? 'Thinking'
                    : 'Preparing'}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft tnum hidden sm:inline">
              #PRAC-2026
            </span>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Visualizer */}
          <div className="relative w-48 h-48 flex items-center justify-center mb-12">
            {micState === 'AI_SPEAKING' ? (
              <>
                <div
                  className="absolute inset-0 rounded-full bg-accent/20 animate-ping"
                  style={{ animationDuration: '2s' }}
                />
                <div className="w-32 h-32 rounded-full bg-accent flex items-center justify-center relative z-10 shadow-soft-lg">
                  <Volume2 className="w-12 h-12 text-paper animate-pulse" style={{ animationDuration: '1s' }} />
                </div>
              </>
            ) : micState === 'PROCESSING' || micState === 'PREPARING' ? (
              <div className="w-32 h-32 rounded-full border-[3px] border-ink/15 border-t-accent animate-spin" />
            ) : (
              <>
                <div
                  className="absolute rounded-full border-[1.5px] border-accent transition-all duration-75 ease-out"
                  style={{ width: ringRadius * 2, height: ringRadius * 2, opacity: Math.max(0.2, audioLevel / 50) }}
                />
                <div className="w-32 h-32 rounded-full border-[3px] border-accent/30 flex items-center justify-center relative z-10">
                  <div
                    className={
                      'w-10 h-10 rounded-full bg-accent transition-all duration-75 ' +
                      (audioLevel > 5 ? 'scale-110' : 'scale-100')
                    }
                  />
                </div>
              </>
            )}
          </div>

          {/* Status & Controls */}
          <div className="min-h-[120px] flex flex-col items-center justify-center text-center">
            {micState === 'AI_SPEAKING' ? (
              <>
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2">
                  / On air
                </div>
                <p className="font-display text-[22px] tracking-[-0.01em] text-ink">
                  Nisha is speaking…
                </p>
              </>
            ) : micState === 'PROCESSING' ? (
              <>
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2">
                  / Processing
                </div>
                <p className="font-display text-[22px] tracking-[-0.01em] text-ink-muted animate-pulse">
                  Thinking…
                </p>
              </>
            ) : micState === 'PREPARING' ? (
              <>
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2">
                  / Get ready
                </div>
                <p className="font-display text-[22px] tracking-[-0.01em] text-ink-muted">
                  In just a sec…
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
                  / Your turn
                </div>
                <p className="font-display text-[26px] tracking-[-0.02em] font-semibold text-ink">
                  Talk when you&apos;re ready.
                </p>
                <button
                  onClick={stopRecordingAndProcess}
                  className="w-[76px] h-[76px] rounded-full bg-accent flex items-center justify-center active:scale-95 transition shadow-soft-lg"
                  aria-label="Stop recording"
                >
                  <Square className="w-7 h-7 text-paper fill-paper" strokeWidth={0} />
                </button>
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
                  Tap to respond
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DONE SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (screenState === 'DONE') {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col">
        <header className="border-b border-ink/15 bg-paper-deep/40">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
              Practice · Complete
            </span>
            <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
              <Check className="w-3 h-3" strokeWidth={2.5} />
              Done
            </span>
          </div>
        </header>

        <main className="flex-1 max-w-[720px] w-full mx-auto px-4 sm:px-8 py-14 sm:py-20">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent mb-6">
            / 100% ready
          </div>
          <h1
            className="font-display font-extrabold tracking-[-0.03em] text-ink mb-6"
            style={{ fontSize: 'clamp(44px, 8vw, 88px)', lineHeight: 0.9 }}
          >
            Great practice.
          </h1>
          <p className="font-display text-[19px] leading-[1.45] text-ink-muted tracking-[-0.01em] max-w-[560px]">
            Your mic sounds clear, Nisha came through warm, and you&apos;re set for the real interview.
          </p>

          <div className="mt-10 border border-ink/15 rounded-[4px] p-5 bg-paper-deep/40">
            <SetupStatusRow idx="01" label="Microphone checked" ready />
            <SetupStatusRow idx="02" label="Audio clarity checked" ready />
            <div className="mt-4 pt-4 border-t border-ink/10">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2">
                / Tip
              </div>
              <p className="font-display text-[15px] text-ink-muted leading-[1.5]">
                In the real interview, take a quick breath before answering — it gives you a tiny moment to collect your thoughts.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-ink/20 text-ink font-display font-semibold text-[15px] hover:bg-ink hover:text-paper transition"
            >
              Practice again
            </button>
            <Link
              href="/"
              className="group inline-flex items-center justify-center gap-3 pl-6 pr-2 py-2 rounded-full bg-accent text-paper font-display font-semibold text-[17px] tracking-[-0.01em] hover:bg-accent-deep transition"
            >
              I&apos;m ready
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-paper text-accent group-hover:translate-x-1 transition">
                <ArrowRight className="w-4 h-4" strokeWidth={2.2} />
              </span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return null;
}
