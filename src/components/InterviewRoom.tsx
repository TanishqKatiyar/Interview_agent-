'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Square,
  Loader2,
  CheckCircle,
  WifiOff,
  AlertCircle,
  Keyboard,
  Volume2,
} from 'lucide-react';

import type { Interview, TranscriptEntry, InterviewPhase, CoachingTip } from '@/lib/types';
import VoiceManager from '@/lib/speech';
import InterviewEngine from '@/lib/interview-engine';
import { updateInterview, uploadAudio } from '@/lib/supabase';
import { getInterviewerResponse, preflightCheck } from '@/lib/llm';
import { getNextEmergencyResponse, resetEmergencyResponses } from '@/lib/emergency-responses';
import { logInfo, logWarn, logError, forceFlushLogs } from '@/lib/logger';
import { useBrowserCompatibility } from './BrowserCheck';

// ─── Types & Constants ───────────────────────────────────────────────────────

type ScreenState = 'SETUP' | 'INTERVIEW' | 'DONE';
// PREPARING = 500ms buffer after AI speaks, before mic starts recording
type MicState = 'AI_SPEAKING' | 'PREPARING' | 'RECORDING' | 'PROCESSING';

interface InterviewRoomProps {
  interview: Interview;
}

const PHASE_LABELS: Record<InterviewPhase, string> = {
  GREETING: 'Greeting',
  WARM_UP: 'Warm-up',
  CORE_ASSESSMENT: 'Assessment',
  SCENARIO: 'Role-play',
  WRAP_UP: 'Wrap-up',
  ENDED: 'Ended',
};

const HARD_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const SILENCE_NUDGE_1_MS = 30_000;       // 30s → gentle nudge
const SILENCE_NUDGE_2_MS = 60_000;       // 60s → mic trouble hint
const TTS_READ_DELAY_MS = 4_000;         // show text N ms before auto-continuing
const MAX_STT_RETRIES = 3;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── AudioVisualizer (inline, no dynamic import needed) ─────────────────────

const AudioVisualizer = dynamic(() => import('./AudioVisualizer'), {
  ssr: false,
  loading: () => (
    <div className="w-20 h-20 sm:w-[120px] sm:h-[120px] rounded-full bg-ink/80 animate-pulse mx-auto" />
  ),
});

// ─── Timer ───────────────────────────────────────────────────────────────────

function Timer({ startTime }: { startTime: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startTime]);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <span>
      {m}:{s.toString().padStart(2, '0')}
    </span>
  );
}

// ─── MicButton ───────────────────────────────────────────────────────────────

function MicButton({
  micState,
  audioLevel,
  onTap,
}: {
  micState: MicState;
  audioLevel: number;
  onTap: () => void;
}) {
  if (micState === 'AI_SPEAKING') {
    return (
      <div className="flex flex-col items-center gap-3">
        <button
          disabled
          className="w-[72px] h-[72px] rounded-full bg-ink-soft flex items-center justify-center opacity-90 cursor-not-allowed"
        >
          <div className="flex gap-1 h-6 items-end">
            {[0, 150, 300].map((delay) => (
              <div
                key={delay}
                className="w-1.5 bg-paper rounded-full animate-bounce"
                style={{ height: '60%', animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </button>
        <p className="text-paper/70 font-mono text-[11px] uppercase tracking-[0.22em]">Nisha is speaking…</p>
      </div>
    );
  }

  if (micState === 'PREPARING') {
    return (
      <div className="flex flex-col items-center gap-3">
        <button
          disabled
          className="w-[72px] h-[72px] rounded-full bg-sunshine flex items-center justify-center opacity-95 cursor-not-allowed"
        >
          <Volume2 className="w-7 h-7 text-ink" />
        </button>
        <p className="text-sunshine font-mono text-[11px] uppercase tracking-[0.22em]">Get ready…</p>
      </div>
    );
  }

  if (micState === 'PROCESSING') {
    return (
      <div className="flex flex-col items-center gap-3">
        <button
          disabled
          className="w-[72px] h-[72px] rounded-full bg-ink-soft flex items-center justify-center opacity-90 cursor-not-allowed"
        >
          <Loader2 className="w-8 h-8 text-paper animate-spin" />
        </button>
        <p className="text-paper/70 font-mono text-[11px] uppercase tracking-[0.22em]">Thinking…</p>
      </div>
    );
  }

  // RECORDING — active, tappable, green audio-level ring
  const ringRadius = 40 + audioLevel * 12; // 40–52px
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">
        {/* Audio level ring */}
        <div
          className="absolute rounded-full border-[3px] border-accent opacity-70 transition-all duration-75 pointer-events-none"
          style={{ width: ringRadius * 2, height: ringRadius * 2 }}
        />
        <button
          onClick={onTap}
          className="w-[72px] h-[72px] rounded-full bg-accent flex items-center justify-center shadow-[0_0_24px_rgba(214,52,38,0.35)] z-10 active:scale-95 transition-transform"
        >
          <Square className="w-8 h-8 text-paper fill-paper" />
        </button>
      </div>
      <p className="text-paper/75 font-mono text-[11px] uppercase tracking-[0.22em]">Tap when you&apos;re done</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InterviewRoom({ interview }: InterviewRoomProps) {
  // ── Screen / mic states ──
  const browserStatus = useBrowserCompatibility();
  const [screenState, setScreenState] = useState<ScreenState>('SETUP');
  const [micState, setMicState] = useState<MicState>('AI_SPEAKING');
  const micStateRef = useRef<MicState>('AI_SPEAKING');
  const screenStateRef = useRef<ScreenState>('SETUP');

  // Sync refs
  useEffect(() => { micStateRef.current = micState; }, [micState]);
  useEffect(() => { screenStateRef.current = screenState; }, [screenState]);

  // Prevent double-fires — single in-flight guard
  const processingRef = useRef(false);

  // ── Setup UI state ──
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [micReady, setMicReady] = useState(false);
  const [llmReady, setLlmReady] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [greetingBlob, setGreetingBlob] = useState<Blob | null>(null);

  // ── Network ──
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const offlineTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingAnswerRef = useRef<string | null>(null);

  // ── Interview UI state ──
  const [messages, setMessages] = useState<TranscriptEntry[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [ttsFailedText, setTtsFailedText] = useState<string | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const sttRetryCount = useRef(0);
  const recordingStartTime = useRef<number>(0);

  // ── Resume dialog ──
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [savedState, setSavedState] = useState<any>(null);

  // ── Coaching feedback (Feature 1) ──
  const [coachingTips, setCoachingTips] = useState<CoachingTip[] | null>(null);
  const [coachingLoading, setCoachingLoading] = useState(false);

  // ── End-interview confirmation modal ──
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // ── Core refs ──
  const engineRef = useRef<InterviewEngine | null>(null);
  const voiceRef = useRef<VoiceManager | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const interviewStartTimeRef = useRef(0);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // ── Timers ──
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hardTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════

  // Auto-scroll transcript
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, ttsFailedText]);

  // Audio level polling at ~30fps
  useEffect(() => {
    if (screenState !== 'INTERVIEW') return;
    let rafId: number;
    let last = 0;
    const tick = (now: number) => {
      if (now - last >= 33) {
        if (voiceRef.current) setAudioLevel(voiceRef.current.getAudioLevel());
        last = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [screenState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (hardTimeoutRef.current) clearTimeout(hardTimeoutRef.current);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      voiceRef.current?.destroy();
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Early-leave recovery — persist transcript to the server via sendBeacon so
  // closing the tab doesn't lose the interview. Also keeps the legacy
  // localStorage save for resume support.
  useEffect(() => {
    const beaconFinalize = () => {
      if (screenStateRef.current !== 'INTERVIEW') return;
      const engine = engineRef.current;
      if (!engine) return;

      // Don't beacon for trivially empty interviews (user bounces on greeting).
      const transcript = engine.getTranscript();
      if (transcript.length < 2) return;

      try {
        const payload = JSON.stringify({
          interview_id: interview.id,
          transcript,
          metadata: engine.getMetadata(),
          duration_seconds: engine.getElapsedSeconds(),
        });
        const blob = new Blob([payload], { type: 'application/json' });
        // Prefer sendBeacon — survives tab close. Fall back to keepalive fetch.
        const sent = typeof navigator.sendBeacon === 'function'
          ? navigator.sendBeacon('/api/interviews/finalize', blob)
          : false;
        if (!sent) {
          fetch('/api/interviews/finalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch { /* ignore */ }
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (screenStateRef.current === 'INTERVIEW') {
        saveState();
        beaconFinalize();
        e.preventDefault();
      }
    };
    const onPageHide = () => {
      if (screenStateRef.current === 'INTERVIEW') {
        saveState();
        beaconFinalize();
      }
    };
    const onVisibilityChange = () => {
      // On mobile, pagehide isn't always reliable — fire when page goes hidden.
      if (document.visibilityState === 'hidden' && screenStateRef.current === 'INTERVIEW') {
        saveState();
        beaconFinalize();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [interview.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for saved state
  useEffect(() => {
    const saved = localStorage.getItem(`interview_state_${interview.id}`);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (Date.now() - state.savedAt < 30 * 60 * 1000 && interview.status === 'in_progress') {
          setSavedState(state);
          setShowResumeDialog(true);
        } else {
          localStorage.removeItem(`interview_state_${interview.id}`);
        }
      } catch {
        localStorage.removeItem(`interview_state_${interview.id}`);
      }
    }
  }, [interview.id, interview.status]);

  // Network monitor
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineModal(false);
      if (offlineTimerRef.current) { clearTimeout(offlineTimerRef.current); offlineTimerRef.current = null; }
      const queued = pendingAnswerRef.current;
      if (queued && screenStateRef.current === 'INTERVIEW') {
        pendingAnswerRef.current = null;
        processAnswer(queued);
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      logWarn('interview', 'Network dropped', { phase: engineRef.current?.getCurrentPhase() }, interview.id);
      offlineTimerRef.current = setTimeout(() => {
        if (screenStateRef.current === 'INTERVIEW') { saveState(); setShowOfflineModal(true); }
      }, 3 * 60 * 1000);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Visibility change — reacquire wake lock
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && screenStateRef.current === 'INTERVIEW') {
        if ('wakeLock' in navigator) {
          navigator.wakeLock.request('screen').then((l) => { wakeLockRef.current = l; }).catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Coaching feedback polling — runs once interview reaches DONE state
  useEffect(() => {
    if (screenState !== 'DONE') return;
    if (coachingTips !== null) return;

    setCoachingLoading(true);
    let attempts = 0;
    const maxAttempts = 12; // ~60s budget

    let timerId: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch(`/api/interviews/${interview.id}/coaching`);
        if (res.ok) {
          const data = await res.json();
          if (data.coaching_feedback && data.coaching_feedback.length > 0) {
            setCoachingTips(data.coaching_feedback);
            setCoachingLoading(false);
            return;
          }
        }
      } catch { /* ignore */ }

      attempts++;
      if (attempts >= maxAttempts) { setCoachingLoading(false); return; }
      timerId = setTimeout(poll, 5000);
    };

    timerId = setTimeout(poll, 3000);
    return () => clearTimeout(timerId);
  }, [screenState, interview.id, coachingTips]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const addMessage = useCallback((role: TranscriptEntry['role'], content: string) => {
    setMessages((prev) => [...prev, { role, content, timestamp: 0, phase: engineRef.current?.getCurrentPhase() ?? 'GREETING' }]);
  }, []);

  const saveState = useCallback(() => {
    if (!engineRef.current) return;
    localStorage.setItem(`interview_state_${interview.id}`, JSON.stringify({
      transcript: engineRef.current.getTranscript(),
      phase: engineRef.current.getCurrentPhase(),
      currentQuestionIndex: engineRef.current.currentQuestionIndex,
      selectedQuestions: engineRef.current.selectedQuestions,
      exchangeCount: engineRef.current.exchangeCount,
      elapsedSeconds: engineRef.current.getElapsedSeconds(),
      savedAt: Date.now(),
    }));
  }, [interview.id]);

  const showToast = useCallback((msg: string, ms = 3000) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), ms);
  }, []);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SILENCE TIMER — nudges after 30s and 60s
  // ═══════════════════════════════════════════════════════════════════════════

  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer();

    silenceTimerRef.current = setTimeout(async () => {
      if (micStateRef.current !== 'RECORDING') return;
      const nudge1 = "Take your time! Whenever you're ready, just tap the button when you're done.";
      setMicState('AI_SPEAKING');
      micStateRef.current = 'AI_SPEAKING';
      clearSilenceTimer();
      try { await voiceRef.current?.speak(nudge1); } catch { setTtsFailedText(nudge1); await wait(TTS_READ_DELAY_MS); }
      setTtsFailedText(null);
      await transitionToRecording();

      // Second timer
      silenceTimerRef.current = setTimeout(async () => {
        if (micStateRef.current !== 'RECORDING') return;
        const nudge2 = "If you're having mic trouble, you can try refreshing the page.";
        setMicState('AI_SPEAKING');
        micStateRef.current = 'AI_SPEAKING';
        try { await voiceRef.current?.speak(nudge2); } catch { setTtsFailedText(nudge2); await wait(TTS_READ_DELAY_MS); }
        setTtsFailedText(null);
        await transitionToRecording();
      }, SILENCE_NUDGE_2_MS - SILENCE_NUDGE_1_MS);

    }, SILENCE_NUDGE_1_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSITION TO RECORDING
  // ═══════════════════════════════════════════════════════════════════════════

  const transitionToRecording = useCallback(async () => {
    setMicState('PREPARING');
    micStateRef.current = 'PREPARING';
    await wait(500); // echo dissipation buffer
    voiceRef.current?.startListening();
    recordingStartTime.current = Date.now();
    setMicState('RECORDING');
    micStateRef.current = 'RECORDING';
    startSilenceTimer();
  }, [startSilenceTimer]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEAK (TTS with visual fallback)
  // ═══════════════════════════════════════════════════════════════════════════

  const speakWithFallback = useCallback(async (text: string) => {
    setTtsFailedText(null);
    try {
      await voiceRef.current?.speak(text);
    } catch (err) {
      console.error('[TTS] Failed:', err);
      setTtsFailedText(text);
      logError('tts', 'TTS failed, showing visual fallback', { text_length: text.length }, interview.id);
      await wait(TTS_READ_DELAY_MS);
      setTtsFailedText(null);
    }
  }, [interview.id]);

  // ═══════════════════════════════════════════════════════════════════════════
  // END INTERVIEW
  // ═══════════════════════════════════════════════════════════════════════════

  const endInterview = useCallback(async () => {
    clearSilenceTimer();
    if (hardTimeoutRef.current) clearTimeout(hardTimeoutRef.current);
    setMicState('PROCESSING');

    const vm = voiceRef.current;
    let audioUrl = '';
    if (vm) {
      try {
        const blob = await vm.stopRecording();
        if (blob.size > 0) audioUrl = await uploadAudio(interview.id, blob);
      } catch (e) {
        console.error('[END] Audio upload failed:', e);
      }
      vm.destroy();
    }

    if (engineRef.current) {
      engineRef.current.forceEnd();
      const payload = {
        status: 'completed' as const,
        transcript: engineRef.current.getTranscript(),
        metadata: engineRef.current.getMetadata(),
        audio_url: audioUrl || undefined,
        completed_at: new Date().toISOString(),
        duration_seconds: Math.floor((Date.now() - (interviewStartTimeRef.current || Date.now())) / 1000),
      };

      try {
        await updateInterview(interview.id, payload);
        localStorage.removeItem(`interview_state_${interview.id}`);
        logInfo('interview', 'Interview completed', { duration_seconds: payload.duration_seconds }, interview.id);
        fetch('/api/interviews/assess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interview_id: interview.id }),
        }).catch(() => {});
      } catch (error) {
        logError('db', 'Failed to save interview', { error: String(error) }, interview.id);
        localStorage.setItem(`interview_backup_${interview.id}`, JSON.stringify({ ...payload, savedAt: Date.now() }));
      }
    }

    wakeLockRef.current?.release().catch(() => {});
    await forceFlushLogs();
    setScreenState('DONE');
  }, [interview.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCESS CANDIDATE ANSWER
  // ═══════════════════════════════════════════════════════════════════════════

  const processAnswer = useCallback(async (answerText: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      clearSilenceTimer();
      setMicState('PROCESSING');
      micStateRef.current = 'PROCESSING';

      const engine = engineRef.current!;
      engine.addEntry('candidate', answerText);
      addMessage('candidate', answerText);
      saveState();

      // Verbal end-intent: candidate explicitly asks to wrap up.
      // Matches phrases like "end the interview", "stop interview", "I want to stop",
      // "let's end here", "I'm done", "I have to leave", "we should wrap up".
      const lower = answerText.toLowerCase().trim();
      const endIntentRegex = /\b(end|stop|finish|wrap\s*up|cut\s*it\s*short|leave|exit|terminate)\b.{0,30}\b(interview|call|chat|session|here|now|early)\b|\bi['’]?m?\s*(done|finished|tired|leaving)\b|\b(can|could|let'?s|gotta|got to|have to|need to)\s+(we\s+)?(end|stop|wrap|finish|leave|exit|go)\b/;
      if (endIntentRegex.test(lower)) {
        const farewell = "Totally fine — thanks so much for chatting. We'll wrap things up here. You'll hear from the Cuemath team soon. Take care!";
        engine.addEntry('ai', farewell);
        addMessage('ai', farewell);
        setMicState('AI_SPEAKING');
        micStateRef.current = 'AI_SPEAKING';
        await speakWithFallback(farewell);
        await endInterview();
        return;
      }

      // Phase check
      if (engine.shouldAdvancePhase()) engine.advancePhase();

      // Check end condition
      if (engine.isEnded()) {
        await endInterview();
        return;
      }

      // LLM call
      let aiResponse: string;
      try {
        aiResponse = await getInterviewerResponse(engine.buildSystemPrompt(), engine.getCompressedTranscript());
        sttRetryCount.current = 0; // reset STT fail counter on any successful flow
      } catch (err) {
        console.error('[LLM] Failed, using emergency response:', err);
        logWarn('recovery', 'LLM failed, emergency response used', {
          phase: engine.getCurrentPhase(),
          error: err instanceof Error ? err.message : String(err),
        }, interview.id);
        aiResponse = getNextEmergencyResponse(engine.getCurrentPhase());
      }

      engine.addEntry('ai', aiResponse);
      addMessage('ai', aiResponse);
      saveState();

      // Phase check again (AI response may end the phase)
      if (engine.shouldAdvancePhase()) engine.advancePhase();

      // Speak
      setMicState('AI_SPEAKING');
      micStateRef.current = 'AI_SPEAKING';

      if (engine.isEnded()) {
        await speakWithFallback(aiResponse);
        await endInterview();
        return;
      }

      await speakWithFallback(aiResponse);
      await transitionToRecording();
    } finally {
      processingRef.current = false;
    }
  }, [addMessage, saveState, endInterview, speakWithFallback, transitionToRecording, interview.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════════
  // MIC TAP HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

  const handleMicTap = useCallback(async () => {
    if (micStateRef.current !== 'RECORDING') return; // guard double-fire
    if (processingRef.current) return;

    // Ignore accidental taps within 1 second of recording start
    if (Date.now() - recordingStartTime.current < 1000) {
      showToast('Speak your answer first, then tap when done');
      return;
    }

    clearSilenceTimer();
    setMicState('PROCESSING');
    micStateRef.current = 'PROCESSING';

    // Get transcript from Deepgram
    const { transcript, confidence } = await (voiceRef.current?.stopListening() ?? Promise.resolve({ transcript: '', confidence: 0 }));

    console.log(`[STT] Got: "${transcript}" (${(confidence * 100).toFixed(0)}%)`);

    // Validate
    if (!transcript || transcript.trim().length < 2) {
      sttRetryCount.current += 1;

      if (sttRetryCount.current >= MAX_STT_RETRIES) {
        setShowTextInput(true);
        const msg = "I think your mic might be having trouble. No worries — you can type your answer below instead.";
        engineRef.current?.addEntry('ai', msg);
        addMessage('ai', msg);
        setMicState('AI_SPEAKING');
        micStateRef.current = 'AI_SPEAKING';
        await speakWithFallback(msg);
        await transitionToRecording();
        return;
      }

      const retry = "Hmm, I didn't quite catch that. Could you try one more time?";
      engineRef.current?.addEntry('ai', retry);
      addMessage('ai', retry);
      setMicState('AI_SPEAKING');
      micStateRef.current = 'AI_SPEAKING';
      await speakWithFallback(retry);
      await transitionToRecording();
      return;
    }

    // Good transcript — reset retry count, hide text input
    sttRetryCount.current = 0;
    setShowTextInput(false);

    // Offline guard
    if (!isOnline) {
      pendingAnswerRef.current = transcript;
      showToast('Waiting for connection to resume...');
      return;
    }

    await processAnswer(transcript);
  }, [addMessage, showToast, speakWithFallback, transitionToRecording, processAnswer, isOnline]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPED ANSWER SUBMIT
  // ═══════════════════════════════════════════════════════════════════════════

  const handleTypedSubmit = useCallback(async () => {
    const text = typedAnswer.trim();
    if (!text) return;
    setTypedAnswer('');
    setShowTextInput(false);

    if (!isOnline) {
      pendingAnswerRef.current = text;
      showToast('Waiting for connection to resume...');
      return;
    }

    await processAnswer(text);
  }, [typedAnswer, isOnline, processAnswer, showToast]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SETUP MIC
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSetupMic = useCallback(async () => {
    setSetupLoading(true);
    setSetupError(null);

    const vm = new VoiceManager();
    voiceRef.current = vm;

    // Pre-generate greeting audio so "Start Interview" is instant
    const precacheGreeting = async (): Promise<Blob | null> => {
      try {
        const text = new InterviewEngine().getOpeningMessage();
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: 'en-US-AvaMultilingualNeural' }),
        });
        if (res.ok) return await res.blob();
      } catch { /* non-fatal */ }
      return null;
    };

    const [micResult, preflightResult, greetingResult] = await Promise.allSettled([
      vm.init(),
      preflightCheck(),
      precacheGreeting(),
    ]);

    // Mic is required
    if (micResult.status === 'rejected' || !micResult.value.success) {
      setSetupError('Could not access microphone. Please allow mic access in your browser settings.');
      setSetupLoading(false);
      voiceRef.current = null;
      return;
    }
    setMicReady(true);

    // LLM preflight (non-blocking — emergency responses cover any failure)
    setLlmReady(true);
    if (preflightResult.status === 'rejected') {
      console.warn('[PREFLIGHT] Failed — will use emergency responses if needed');
    }

    // Greeting blob
    if (greetingResult.status === 'fulfilled' && greetingResult.value) {
      setGreetingBlob(greetingResult.value);
      setVoiceReady(true);
    } else {
      setVoiceReady(true); // TTS will just call API live -- still functional
    }

    setSetupLoading(false);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // START INTERVIEW
  // ═══════════════════════════════════════════════════════════════════════════

  const handleStartInterview = useCallback(async () => {
    // iOS audio unlock
    try {
      const ACtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (ACtor) {
        const ctx = new ACtor();
        if (ctx.state === 'suspended') await ctx.resume();
        ctx.createBufferSource().start(0);
      }
    } catch { /* ignore */ }

    // Wake lock
    if ('wakeLock' in navigator) {
      try { wakeLockRef.current = await navigator.wakeLock.request('screen'); } catch { /* ignore */ }
    }

    const engine = new InterviewEngine();
    engineRef.current = engine;
    resetEmergencyResponses();
    interviewStartTimeRef.current = Date.now();
    setMessages([]);

    // Hard timeout
    hardTimeoutRef.current = setTimeout(async () => {
      if (screenStateRef.current !== 'INTERVIEW') return;
      const goodbye = "Hey we've been chatting a while! Let me wrap up — thanks so much for your time today, you did great. You'll hear from us soon!";
      engine.addEntry('ai', goodbye);
      addMessage('ai', goodbye);
      setMicState('AI_SPEAKING');
      micStateRef.current = 'AI_SPEAKING';
      await speakWithFallback(goodbye);
      await endInterview();
    }, HARD_TIMEOUT_MS);

    setScreenState('INTERVIEW');
    setMicState('AI_SPEAKING');
    micStateRef.current = 'AI_SPEAKING';

    // Start full recording
    voiceRef.current?.startRecording();

    const greetingText = engine.getOpeningMessage();
    engine.addEntry('ai', greetingText);
    addMessage('ai', greetingText);

    logInfo('interview', 'Interview started', {
      candidate_name: interview.candidate_name,
      candidate_email: interview.candidate_email,
    }, interview.id);

    // Play greeting: instant if pre-generated, otherwise live API call
    if (greetingBlob) {
      try {
        await voiceRef.current?.ttsClient.playPregenerated(greetingBlob);
      } catch {
        await speakWithFallback(greetingText);
      }
    } else {
      await speakWithFallback(greetingText);
    }

    saveState();
    await transitionToRecording();
  }, [greetingBlob, addMessage, saveState, speakWithFallback, endInterview, transitionToRecording, interview.candidate_name, interview.candidate_email, interview.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════════
  // RESUME
  // ═══════════════════════════════════════════════════════════════════════════

  const handleResumeChoice = useCallback(async (resume: boolean) => {
    setShowResumeDialog(false);

    if (resume && savedState) {
      try {
        const engine = new InterviewEngine();
        engine.transcript = savedState.transcript || [];
        engine.phase = savedState.phase || 'GREETING';
        engine.currentQuestionIndex = savedState.currentQuestionIndex ?? 0;
        engine.selectedQuestions = savedState.selectedQuestions || engine.selectedQuestions;
        engine.exchangeCount = savedState.exchangeCount ?? 0;
        engineRef.current = engine;
        setMessages([...engine.getTranscript()]);
        interviewStartTimeRef.current = Date.now() - (savedState.elapsedSeconds || 0) * 1000;
        resetEmergencyResponses();

        if ('wakeLock' in navigator) {
          navigator.wakeLock.request('screen').then((l) => { wakeLockRef.current = l; }).catch(() => {});
        }

        const remainingMs = HARD_TIMEOUT_MS - (savedState.elapsedSeconds || 0) * 1000;
        if (remainingMs > 0) {
          hardTimeoutRef.current = setTimeout(async () => {
            if (screenStateRef.current !== 'INTERVIEW') return;
            const goodbye = "Hey we've been chatting a while! Let me wrap up — thanks so much for your time. You'll hear from us soon!";
            engine.addEntry('ai', goodbye);
            addMessage('ai', goodbye);
            setMicState('AI_SPEAKING');
            micStateRef.current = 'AI_SPEAKING';
            await speakWithFallback(goodbye);
            await endInterview();
          }, remainingMs);
        }

        const vm = voiceRef.current || new VoiceManager();
        if (!voiceRef.current) {
          await vm.init();
          voiceRef.current = vm;
        }
        vm.startRecording();

        setScreenState('INTERVIEW');
        setMicState('AI_SPEAKING');
        micStateRef.current = 'AI_SPEAKING';

        const resumeMsg = "Hey welcome back! Let's pick up where we left off.";
        engine.addEntry('ai', resumeMsg);
        addMessage('ai', resumeMsg);
        await speakWithFallback(resumeMsg);
        await transitionToRecording();
        return;
      } catch (e) {
        console.error('[RESUME] Failed:', e);
      }
    }

    localStorage.removeItem(`interview_state_${interview.id}`);
    setSavedState(null);
  }, [savedState, addMessage, speakWithFallback, endInterview, transitionToRecording, interview.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — UNSUPPORTED BROWSER
  // ═══════════════════════════════════════════════════════════════════════════

  if (browserStatus === 'unsupported') {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-[520px]">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
            Blocker // 01
          </div>
          <h1
            className="mt-3 font-display font-semibold leading-[0.95] tracking-[-0.03em]"
            style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}
          >
            Browser unsupported<span className="text-accent">.</span>
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
            This screening needs microphone + audio features your browser doesn&apos;t expose.
            Please use Chrome, Edge, or Safari on iOS to continue.
          </p>
          <div className="mt-8 border border-ink border-[1.5px] px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-accent" strokeWidth={1.8} />
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink leading-[1.6]">
              Switch browser and reload this link
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — SETUP SCREEN
  // ═══════════════════════════════════════════════════════════════════════════

  if (screenState === 'SETUP') {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col">

        {/* Resume Dialog */}
        {showResumeDialog && (
          <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4">
            <div className="bg-paper border border-ink border-[1.5px] shadow-[8px_8px_0_0_#0A0A0A] max-w-[420px] w-full">
              <div className="border-b border-ink border-b-[1.5px] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                Resume // Saved session
              </div>
              <div className="px-6 py-6">
                <h3 className="font-display text-[26px] font-semibold leading-[1] tracking-[-0.02em]">
                  Welcome back.
                </h3>
                <p className="mt-3 text-[14px] text-ink-muted leading-relaxed">
                  Your interview was interrupted. Want to pick up where you left off?
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => handleResumeChoice(false)}
                    className="flex-1 border border-ink border-[1.5px] py-3 font-display text-[15px] font-medium tracking-[-0.01em] hover:bg-ink hover:text-paper transition"
                  >
                    Start over
                  </button>
                  <button
                    onClick={() => handleResumeChoice(true)}
                    className="flex-1 bg-ink text-paper py-3 font-display text-[15px] font-medium tracking-[-0.01em] shadow-[4px_4px_0_0_#0A0A0A] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0_0_#FF6B35] transition"
                  >
                    Resume →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Editorial top strip */}
        <header className="border-b border-ink border-b-[1.5px]">
          <div className="mx-auto max-w-[960px] px-5 sm:px-8 py-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.22em] text-ink">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span>Session // Setup</span>
            </div>
            <span className="font-display font-semibold normal-case text-[14px] tracking-normal">
              Cue<span className="text-accent">math</span>
            </span>
          </div>
        </header>

        <main className="flex-1 mx-auto max-w-[960px] w-full px-5 sm:px-8 py-10 md:py-14">
          {/* Masthead */}
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
            Screening № {interview.id.slice(0, 6).toUpperCase()} / {interview.candidate_name}
          </div>
          <h1
            className="mt-4 font-display font-semibold leading-[0.92] tracking-[-0.04em]"
            style={{ fontSize: 'clamp(48px, 8vw, 104px)' }}
          >
            Hi {interview.candidate_name.split(' ')[0]}<span className="text-accent">.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-muted">
            Before we go live: a few ground rules. It takes about 8–10 minutes.
          </p>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-10">
            {/* Instructions grid */}
            <div className="lg:col-span-7 border-t border-ink border-t-[1.5px]">
              {[
                { idx: '01', label: 'Browser',    body: 'Use Chrome for the best experience.' },
                { idx: '02', label: 'Environment', body: 'Find a quiet spot with a good mic.' },
                { idx: '03', label: 'Duration',   body: 'Takes about 8–10 minutes end-to-end.' },
                { idx: '04', label: 'Style',      body: 'Just speak naturally — tap the red button when you\u2019re done answering.' },
              ].map((r) => (
                <div
                  key={r.idx}
                  className="grid grid-cols-12 gap-4 py-5 border-b border-ink/15"
                >
                  <div className="col-span-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft tnum">
                    {r.idx}
                  </div>
                  <div className="col-span-10 sm:col-span-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink">
                    {r.label}
                  </div>
                  <div className="col-span-12 sm:col-span-7 text-[15px] leading-relaxed text-ink">
                    {r.body}
                  </div>
                </div>
              ))}
            </div>

            {/* Action column */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
                Form // Ready check
              </div>

              {!micReady ? (
                <button
                  onClick={handleSetupMic}
                  disabled={setupLoading}
                  className="group w-full flex items-center justify-between px-5 py-4 sm:py-5 bg-ink text-paper font-display text-[18px] sm:text-[20px] font-medium tracking-[-0.01em] transition-transform duration-200 hover:-translate-x-[3px] hover:-translate-y-[3px] shadow-[4px_4px_0_0_#0A0A0A] hover:shadow-[7px_7px_0_0_#FF6B35] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#0A0A0A] disabled:bg-ink-soft disabled:cursor-not-allowed disabled:hover:transform-none disabled:shadow-[4px_4px_0_0_#A3A3A3]"
                >
                  {setupLoading ? (
                    <>
                      <span>Setting up…</span>
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </>
                  ) : (
                    <>
                      <span>Set up microphone</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              ) : (
                <>
                  <div className="border border-ink border-[1.5px] divide-y divide-ink/15">
                    {[
                      { done: micReady,  label: 'Microphone ready', code: 'MIC' },
                      { done: llmReady,  label: 'AI connected',     code: 'LLM' },
                      { done: voiceReady, label: 'Voice ready',      code: 'TTS' },
                    ].map((s) => (
                      <div key={s.code} className="flex items-center gap-4 px-4 py-3">
                        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft w-10 tnum">
                          {s.code}
                        </span>
                        <div className="flex-1 font-display text-[16px] tracking-[-0.01em]">
                          {s.label}
                        </div>
                        {s.done ? (
                          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                            <CheckCircle className="w-4 h-4" strokeWidth={2} />
                            Ready
                          </div>
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin text-ink-soft" />
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleStartInterview}
                    disabled={!micReady || !llmReady || !voiceReady}
                    className="group w-full flex items-center justify-between px-5 py-4 sm:py-5 bg-ink text-paper font-display text-[18px] sm:text-[20px] font-medium tracking-[-0.01em] transition-transform duration-200 hover:-translate-x-[3px] hover:-translate-y-[3px] shadow-[4px_4px_0_0_#0A0A0A] hover:shadow-[7px_7px_0_0_#FF6B35] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#0A0A0A] disabled:bg-ink-soft disabled:cursor-not-allowed disabled:hover:transform-none disabled:shadow-[4px_4px_0_0_#A3A3A3]"
                  >
                    <span>Start interview</span>
                    <span>→</span>
                  </button>
                </>
              )}

              {setupError && (
                <div className="flex items-start gap-3 border border-red-600 border-[1.5px] text-red-700 bg-paper px-4 py-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={1.8} />
                  <p className="font-mono text-[12px] uppercase tracking-[0.14em] leading-[1.6]">
                    {setupError}
                  </p>
                </div>
              )}

              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft leading-[1.8]">
                Your voice will be recorded for the duration of the interview and used only for evaluation.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — INTERVIEW SCREEN
  // ═══════════════════════════════════════════════════════════════════════════

  if (screenState === 'INTERVIEW') {
    const currentPhase = messages.length > 0 ? messages[messages.length - 1].phase : 'GREETING';
    return (
      <div className="min-h-screen bg-ink text-paper flex flex-col relative touch-none">

        {/* Offline banner */}
        {!isOnline && (
          <div className="absolute top-0 w-full bg-tangerine text-paper text-center py-2 font-mono text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 z-50 border-b border-paper/20">
            <WifiOff className="w-4 h-4" strokeWidth={1.8} /> Connection lost — reconnecting…
          </div>
        )}

        {/* Offline modal (after 3 minutes) */}
        {showOfflineModal && (
          <div className="fixed inset-0 bg-ink/90 flex items-center justify-center z-[60] p-4">
            <div className="bg-paper text-ink border border-paper border-[1.5px] shadow-[8px_8px_0_0_#FF6B35] max-w-[420px] w-full">
              <div className="border-b border-ink border-b-[1.5px] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                Offline // 03:00
              </div>
              <div className="px-6 py-6">
                <WifiOff className="w-8 h-8 text-ink mb-4" strokeWidth={1.5} />
                <h3 className="font-display text-[26px] font-semibold leading-[1] tracking-[-0.02em]">
                  Connection lost.
                </h3>
                <p className="mt-3 text-[14px] text-ink-muted leading-relaxed">
                  Your progress is saved. Refresh when you&apos;re back online.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-6 w-full bg-ink text-paper py-3 font-display text-[15px] font-medium tracking-[-0.01em] shadow-[4px_4px_0_0_#0A0A0A] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0_0_#FF6B35] transition"
                >
                  Refresh page →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toastMsg && (
          <div className="absolute top-16 w-full flex justify-center z-50 pointer-events-none px-4">
            <div className="bg-paper text-ink border border-paper border-[1.5px] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] shadow-[3px_3px_0_0_#FF6B35]">
              {toastMsg}
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="flex justify-between items-center px-4 sm:px-8 py-3 border-b border-paper/15">
          <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em]">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-accent">Live</span>
            </span>
            <span className="text-paper/30">/</span>
            <span className="text-paper/70">{PHASE_LABELS[currentPhase] || currentPhase}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="font-mono text-[12px] tracking-[0.16em] text-paper tnum">
              <Timer startTime={interviewStartTimeRef.current || Date.now()} />
            </div>
            <button
              onClick={() => setShowEndConfirm(true)}
              disabled={micState === 'PROCESSING'}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-paper/70 hover:text-accent hover:border-accent disabled:opacity-40 disabled:cursor-not-allowed transition px-3 py-1.5 border border-paper/30 border-[1.5px]"
              aria-label="End interview"
            >
              <Square className="w-3 h-3" strokeWidth={2} /> End
            </button>
          </div>
        </div>

        {/* End-interview confirmation modal */}
        {showEndConfirm && (
          <div className="fixed inset-0 bg-ink/90 flex items-center justify-center z-[60] px-4">
            <div className="bg-paper text-ink border border-paper border-[1.5px] shadow-[8px_8px_0_0_#FF6B35] max-w-[420px] w-full">
              <div className="border-b border-ink border-b-[1.5px] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                Confirm // End session
              </div>
              <div className="px-6 py-6">
                <h3 className="font-display text-[26px] font-semibold leading-[1] tracking-[-0.02em]">
                  End now?
                </h3>
                <p className="mt-3 text-[14px] text-ink-muted leading-relaxed">
                  We&apos;ll wrap up and send your responses to the Cuemath team. You can&apos;t rejoin once ended.
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setShowEndConfirm(false)}
                    className="flex-1 border border-ink border-[1.5px] py-3 font-display text-[15px] font-medium tracking-[-0.01em] hover:bg-ink hover:text-paper transition"
                  >
                    Keep going
                  </button>
                  <button
                    onClick={() => { setShowEndConfirm(false); endInterview(); }}
                    className="flex-1 bg-ink text-paper py-3 font-display text-[15px] font-medium tracking-[-0.01em] shadow-[4px_4px_0_0_#0A0A0A] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0_0_#FF6B35] transition"
                  >
                    End now →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Center — visualizer + transcript */}
        <div className="flex-1 flex flex-col justify-center px-4 max-w-3xl mx-auto w-full">
          <AudioVisualizer audioLevel={audioLevel} micState={micState === 'PREPARING' ? 'RECORDING' : micState} />

          {/* Transcript */}
          <div
            ref={transcriptRef}
            className="w-full max-h-[150px] sm:max-h-[220px] overflow-y-auto space-y-5 pr-2 scrollbar-thin scrollbar-thumb-paper/20 mt-4 sm:mt-8"
          >
            {messages.map((entry, i) => {
              const showPhase = i > 0 && entry.phase !== messages[i - 1].phase;
              const isCandidate = entry.role === 'candidate';
              return (
                <div key={i}>
                  {showPhase && (
                    <div className="flex items-center gap-3 my-5">
                      <div className="flex-1 h-px bg-paper/15" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-paper/50">
                        {PHASE_LABELS[entry.phase] || entry.phase}
                      </span>
                      <div className="flex-1 h-px bg-paper/15" />
                    </div>
                  )}
                  <div className={`flex ${isCandidate ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%] flex flex-col">
                      <span
                        className={
                          'font-mono text-[9px] uppercase tracking-[0.28em] mb-1 ' +
                          (isCandidate ? 'text-paper/50 text-right' : 'text-accent')
                        }
                      >
                        {isCandidate ? 'You' : 'Nisha'}
                      </span>
                      <div
                        className={
                          'px-4 py-2.5 text-[14px] sm:text-[15px] leading-relaxed border-[1.5px] ' +
                          (isCandidate
                            ? 'bg-paper text-ink border-paper'
                            : 'bg-transparent text-paper border-paper/25')
                        }
                      >
                        {entry.content}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* TTS failed visual fallback */}
            {ttsFailedText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-4 py-3 text-[14px] leading-relaxed bg-accent/15 border border-accent border-[1.5px] text-paper">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-1.5">
                    <Volume2 className="w-3.5 h-3.5" strokeWidth={2} />
                    Audio unavailable — please read
                  </div>
                  {ttsFailedText}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom — mic button + text input fallback */}
        <div
          className="shrink-0 mb-4 sm:mb-8 relative z-10 w-full flex flex-col items-center gap-3 border-t border-paper/10 pt-4"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="h-[120px] flex items-center justify-center w-full">
            <MicButton micState={micState} audioLevel={audioLevel} onTap={handleMicTap} />
          </div>

          {/* Typed answer fallback (shows when STT fails 3+ times) */}
          {showTextInput && micState === 'RECORDING' && (
            <div className="w-full max-w-md px-4">
              <div className="flex items-center gap-3 bg-paper text-ink border border-paper border-[1.5px] px-3 py-2">
                <Keyboard className="w-4 h-4 text-ink-soft shrink-0" strokeWidth={1.8} />
                <input
                  type="text"
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleTypedSubmit(); }}
                  placeholder="Type your answer here instead"
                  className="flex-1 bg-transparent text-ink text-[14px] outline-none placeholder:text-ink/35"
                />
                <button
                  onClick={handleTypedSubmit}
                  disabled={!typedAnswer.trim()}
                  className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent hover:text-ink disabled:text-ink/30 transition"
                >
                  Send →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — DONE SCREEN
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      {/* Editorial top strip */}
      <header className="border-b border-ink border-b-[1.5px]">
        <div className="mx-auto max-w-[960px] px-5 sm:px-8 py-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.22em] text-ink">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span>Session // Complete</span>
          </div>
          <span className="font-display font-semibold normal-case text-[14px] tracking-normal">
            Cue<span className="text-accent">math</span>
          </span>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-[960px] w-full px-5 sm:px-8 py-12 md:py-16">
        {/* Masthead */}
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
          Transcript // Saved
        </div>
        <h1
          className="mt-4 font-display font-semibold leading-[0.92] tracking-[-0.04em]"
          style={{ fontSize: 'clamp(56px, 9vw, 128px)' }}
        >
          Thank you<span className="text-accent">.</span>
        </h1>
        <p className="mt-6 max-w-xl text-[17px] sm:text-[18px] leading-relaxed text-ink-muted">
          Your interview has been submitted. Nisha and the Cuemath team are already
          reviewing your responses — you&apos;ll hear back soon.
        </p>

        {/* Duration / Status strip */}
        {engineRef.current && (
          <div className="mt-10 grid grid-cols-2 border border-ink border-[1.5px]">
            <div className="p-5 sm:p-7">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                Duration
              </div>
              <div
                className="mt-3 font-display font-semibold leading-[1] tracking-[-0.03em] tnum"
                style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}
              >
                {Math.floor(engineRef.current.getElapsedSeconds() / 60)}:
                {Math.floor(engineRef.current.getElapsedSeconds() % 60).toString().padStart(2, '0')}
              </div>
            </div>
            <div className="p-5 sm:p-7 border-l border-ink border-l-[1.5px] bg-accent text-paper">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-paper/70">
                Status
              </div>
              <div
                className="mt-3 font-display font-semibold leading-[1] tracking-[-0.03em]"
                style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}
              >
                Saved
              </div>
            </div>
          </div>
        )}

        {/* Coaching feedback */}
        {coachingLoading && !coachingTips && (
          <div className="mt-10 border border-ink border-[1.5px] px-5 py-8 flex items-center justify-center gap-3 text-ink-soft">
            <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.8} />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em]">
              Generating your coaching notes…
            </span>
          </div>
        )}

        {coachingTips && coachingTips.length > 0 && (
          <div className="mt-12">
            <div className="flex items-baseline justify-between border-b border-ink border-b-[1.5px] pb-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
                Note // Coaching
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft tnum">
                {String(coachingTips.length).padStart(2, '0')} items
              </div>
            </div>
            <h2 className="mt-5 font-display text-[28px] sm:text-[32px] font-semibold tracking-[-0.02em] leading-[1.05]">
              Takeaways from your interview.
            </h2>
            <ul className="mt-6 border border-ink border-[1.5px]">
              {coachingTips.map((tip, i) => (
                <li
                  key={i}
                  className={
                    'flex items-start gap-4 px-5 py-4 ' +
                    (i > 0 ? 'border-t border-ink/15 ' : '')
                  }
                >
                  <span
                    className={
                      'shrink-0 inline-flex items-center gap-1 px-2 py-[2px] font-mono text-[10px] uppercase tracking-[0.18em] ' +
                      (tip.type === 'strength'
                        ? 'bg-ink text-paper'
                        : 'border border-ink border-[1.5px] text-ink')
                    }
                  >
                    {tip.type === 'strength' ? 'Strength' : 'Try this'}
                  </span>
                  <p className="flex-1 text-[15px] leading-relaxed text-ink">
                    {tip.text}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft leading-[1.8]">
              Suggestions only / Full evaluation handled by the team
            </p>
          </div>
        )}

        {/* What happens next */}
        <div className="mt-12 border border-ink border-[1.5px] px-5 sm:px-7 py-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            Next // 01
          </div>
          <h3 className="mt-2 font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] leading-[1.1]">
            What happens next?
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            The Cuemath team will review your interview and get back to you within 48 hours via email.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-10 flex items-center gap-5 flex-wrap">
          <a
            href="/"
            className="group inline-flex items-center gap-3 bg-ink text-paper font-display text-[16px] font-medium tracking-[-0.01em] px-6 py-3.5 transition-transform duration-150 hover:-translate-x-[3px] hover:-translate-y-[3px] shadow-[4px_4px_0_0_#0A0A0A] hover:shadow-[7px_7px_0_0_#FF6B35] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#0A0A0A]"
          >
            Return home →
          </a>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            You can safely close this tab.
          </p>
        </div>
      </main>

      {/* Footer ticker */}
      <footer className="bg-ink text-paper overflow-hidden border-t border-ink border-t-[1.5px]">
        <div className="marquee-track-fast flex gap-10 whitespace-nowrap font-mono text-[12px] uppercase tracking-[0.22em] py-3">
          {Array.from({ length: 2 }).flatMap((_, r) =>
            [
              'Interview submitted',
              'Nisha // AI Interviewer',
              'Voice first',
              'Review in progress',
              'Built end-to-end',
            ].map((t, i) => (
              <span key={`${r}-${i}`} className="flex items-center gap-10">
                <span>{t}</span>
                <span className="text-accent">●</span>
              </span>
            )),
          )}
        </div>
      </footer>
    </div>
  );
}
