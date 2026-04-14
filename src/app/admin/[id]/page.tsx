'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import Link from 'next/link';
import { getInterviewById, updateInterview } from '@/lib/supabase';
import type { Interview, Assessment, TranscriptEntry, InterviewPhase } from '@/lib/types';
import AssessmentView from '@/components/AssessmentView';
import DeepIntelligenceView from '@/components/DeepIntelligenceView';
import HiringScoreWidget from '@/components/HiringScoreWidget';
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Play,
  Pause,
  Search,
  MessageCircle,
  FileText,
  Check,
  Sparkles,
  StickyNote,
  ShieldCheck,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  GREETING: 'Greeting',
  WARM_UP: 'Warm-up',
  CORE_ASSESSMENT: 'Core Assessment',
  SCENARIO: 'Role-Play Scenario',
  WRAP_UP: 'Wrap-up',
  ENDED: 'Interview Ended',
};

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtDuration(sec: number | null): string {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtAudioTime(sec: number): string {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const REC_STYLES: Record<string, string> = {
  strong_pass: 'bg-ink text-paper',
  pass: 'bg-tangerine text-ink',
  borderline: 'bg-sunshine text-ink',
  fail: 'bg-accent text-paper',
};

const REC_LABELS: Record<string, string> = {
  strong_pass: 'Strong Pass',
  pass: 'Pass',
  borderline: 'Borderline',
  fail: 'Fail',
};

const STATUS_STYLES: Record<string, { cls: string; label: string }> = {
  scheduled: { cls: 'bg-paper-deep text-ink-soft border border-ink/15', label: 'Scheduled' },
  in_progress: { cls: 'bg-sunshine text-ink', label: 'In Progress' },
  completed: { cls: 'bg-tangerine text-ink', label: 'Completed' },
  assessed: { cls: 'bg-ink text-paper', label: 'Assessed' },
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function downloadTranscript(interview: Interview) {
  const lines: string[] = [
    `Cuemath Screener — Interview Transcript`,
    `Candidate: ${interview.candidate_name} (${interview.candidate_email})`,
    `Date: ${fmtDate(interview.created_at)} ${fmtTime(interview.created_at)}`,
    `Duration: ${fmtDuration(interview.duration_seconds)}`,
    '',
    '─'.repeat(60),
    '',
  ];

  let lastPhase = '';
  for (const entry of interview.transcript ?? []) {
    if (entry.phase !== lastPhase) {
      lines.push('', `── ${PHASE_LABELS[entry.phase] ?? entry.phase} ──`, '');
      lastPhase = entry.phase;
    }
    const speaker = entry.role === 'ai' ? 'AI INTERVIEWER' : interview.candidate_name.toUpperCase();
    lines.push(`[${fmtTimestamp(entry.timestamp)}]  ${speaker}:`);
    lines.push(`  ${entry.content}`);
    lines.push('');
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transcript-${interview.candidate_name.replace(/\s+/g, '-').toLowerCase()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Phase divider ─────────────────────────────────────────────────────────

function PhaseDivider({ phase }: { phase: string }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-ink/15" />
      <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft whitespace-nowrap">
        / {PHASE_LABELS[phase] ?? phase}
      </span>
      <div className="flex-1 h-px bg-ink/15" />
    </div>
  );
}

// ─── Chat bubble ───────────────────────────────────────────────────────────

function ChatBubble({
  entry,
  candidateInitials,
}: {
  entry: TranscriptEntry;
  candidateInitials: string;
}) {
  const isAI = entry.role === 'ai';

  return (
    <div
      className={`flex items-start gap-3 mb-4 ${isAI ? 'flex-row' : 'flex-row-reverse'}`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shrink-0 tracking-[0.05em] ${
          isAI ? 'bg-ink text-paper' : 'bg-tangerine text-ink'
        }`}
      >
        {isAI ? 'AI' : candidateInitials}
      </div>

      {/* Bubble */}
      <div className="max-w-[75%]">
        <div
          className={`px-4 py-2.5 rounded-[4px] font-display text-[14px] leading-[1.55] tracking-[-0.005em] ${
            isAI
              ? 'bg-paper-deep border border-ink/15 text-ink'
              : 'bg-ink text-paper'
          }`}
        >
          {entry.content}
        </div>
        <div
          className={`font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mt-1.5 ${
            isAI ? 'text-left' : 'text-right'
          }`}
        >
          {fmtTimestamp(entry.timestamp)}
        </div>
      </div>
    </div>
  );
}

// ─── Audio player ──────────────────────────────────────────────────────────

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoad = () => setDuration(audio.duration);
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnd = () => setPlaying(false);

    audio.addEventListener('loadedmetadata', onLoad);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoad);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * duration;
  };

  const changeSpeed = (s: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = s;
    setSpeed(s);
  };

  const pct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div>
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-4 flex-wrap">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className="w-11 h-11 rounded-full bg-ink text-paper flex items-center justify-center shrink-0 hover:bg-accent transition-colors"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="w-4 h-4" strokeWidth={2} /> : <Play className="w-4 h-4 ml-0.5" strokeWidth={2} />}
        </button>

        {/* Progress */}
        <div className="flex-1 min-w-[180px]">
          <div
            onClick={seek}
            className="h-[6px] bg-ink/10 rounded-full cursor-pointer relative mb-2"
          >
            <div
              className="h-full bg-ink rounded-full transition-[width] duration-100"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between font-mono text-[11px] tnum text-ink-soft tracking-[0.08em]">
            <span>{fmtAudioTime(currentTime)}</span>
            <span>{fmtAudioTime(duration)}</span>
          </div>
        </div>

        {/* Speed */}
        <div className="flex gap-1 shrink-0 bg-paper-deep/60 border border-ink/15 rounded-full p-1">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => changeSpeed(s)}
              className={`px-3 py-1 rounded-full font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
                speed === s ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function SkeletonBlock({ height = 20, width = '100%' }: { height?: number; width?: string | number }) {
  return (
    <div
      className="bg-ink/10 rounded-[2px] animate-pulse"
      style={{ height, width }}
    />
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function InterviewDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Assessment state ──
  const [assessing, setAssessing] = useState(false);

  // ── Notes state ──
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // ── Override state ──
  const [overrideRec, setOverrideRec] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  // ── Reviewed state ──
  const [reviewed, setReviewed] = useState(false);

  // ── Transcript filter ──
  const [transcriptFilter, setTranscriptFilter] = useState<'all' | 'ai' | 'candidate'>('all');

  // Transcript scroll ref
  const transcriptRef = useRef<HTMLDivElement>(null);

  // ── Fetch interview ──
  useEffect(() => {
    getInterviewById(id)
      .then((data) => {
        setInterview(data);
        if (data) {
          const meta = data.metadata as unknown as Record<string, unknown> | null;
          if (meta) {
            if (typeof meta.admin_notes === 'string') setNotes(meta.admin_notes);
            if (typeof meta.reviewed === 'boolean') setReviewed(meta.reviewed);
          }
          setOverrideRec(data.recommendation ?? '');
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load interview:', err);
        setLoading(false);
      });
  }, [id]);

  // ── Auto-poll when status is 'completed' (waiting for assessment) ──
  useEffect(() => {
    if (!interview || interview.status !== 'completed') return;

    const poll = setInterval(async () => {
      try {
        const updated = await getInterviewById(id);
        if (updated && updated.status === 'assessed') {
          setInterview(updated);
          setOverrideRec(updated.recommendation ?? '');
          console.log('[detail] Assessment detected — updating view');
        }
      } catch {
        // Silently ignore poll errors
      }
    }, 5000);

    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, interview?.status]);

  // Scroll transcript to top on load
  useEffect(() => {
    if (!loading && transcriptRef.current) {
      transcriptRef.current.scrollTop = 0;
    }
  }, [loading]);

  // ── Handlers ──

  const handleRunAssessment = useCallback(async () => {
    if (assessing || !interview) return;
    setAssessing(true);
    try {
      const res = await fetch('/api/interviews/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interview_id: interview.id }),
      });
      const data = await res.json();
      if (res.ok && data.assessment) {
        setInterview({
          ...interview,
          assessment: data.assessment as Assessment,
          overall_score: data.assessment.overall_score,
          recommendation: data.assessment.recommendation,
          status: 'assessed',
        });
        setOverrideRec(data.assessment.recommendation);
      } else {
        alert(`Assessment failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Assessment error:', err);
      alert('Failed to run assessment.');
    } finally {
      setAssessing(false);
    }
  }, [assessing, interview]);

  const handleSaveNotes = async () => {
    if (!interview) return;
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      const existing = (interview.metadata && typeof interview.metadata === 'object') ? interview.metadata : {};
      await updateInterview(interview.id, {
        metadata: { ...existing, admin_notes: notes } as never,
      });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save notes:', err);
      alert('Failed to save notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSaveOverride = async () => {
    if (!interview || !overrideRec) return;
    if (overrideRec !== interview.recommendation && !overrideReason.trim()) {
      alert('Please provide a reason for the override.');
      return;
    }
    setSavingOverride(true);
    try {
      const existing = (interview.metadata && typeof interview.metadata === 'object') ? interview.metadata : {};
      await updateInterview(interview.id, {
        recommendation: overrideRec,
        metadata: {
          ...existing,
          override_reason: overrideReason,
          original_recommendation: interview.recommendation,
        } as never,
      });
      setInterview({ ...interview, recommendation: overrideRec });
      setOverrideReason('');
    } catch (err) {
      console.error('Failed to save override:', err);
      alert('Failed to save override.');
    } finally {
      setSavingOverride(false);
    }
  };

  const handleToggleReviewed = async () => {
    if (!interview) return;
    const newVal = !reviewed;
    setReviewed(newVal);
    try {
      const existing = (interview.metadata && typeof interview.metadata === 'object') ? interview.metadata : {};
      await updateInterview(interview.id, {
        metadata: { ...existing, reviewed: newVal } as never,
      });
    } catch (err) {
      console.error('Failed to update reviewed:', err);
      setReviewed(!newVal); // revert
    }
  };

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div>
        <section className="mb-10">
          <SkeletonBlock height={12} width={220} />
          <div className="mt-4">
            <SkeletonBlock height={72} width="60%" />
          </div>
          <div className="mt-6 h-[1.5px] bg-ink" />
        </section>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-7 border border-ink/15 rounded-[4px] bg-paper-deep/40 p-6 flex flex-col gap-4">
            {[...Array(6)].map((_, i) => (
              <SkeletonBlock key={i} height={14} width={i % 2 === 0 ? '85%' : '60%'} />
            ))}
          </div>
          <div className="col-span-12 lg:col-span-5 border border-ink/15 rounded-[4px] bg-paper-deep/40 p-6">
            <SkeletonBlock height={48} width={100} />
            <div className="mt-4">
              <SkeletonBlock height={14} width="100%" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ──
  if (!interview) {
    return (
      <div className="max-w-[640px] mx-auto py-20 px-6 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-paper-deep border border-ink/15 mb-4">
          <Search className="w-4 h-4 text-ink-soft" strokeWidth={1.8} />
        </div>
        <p className="font-display text-[22px] tracking-[-0.02em] text-ink mb-6">
          Interview not found
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 bg-ink text-paper px-5 py-2.5 rounded-full font-mono text-[11px] uppercase tracking-[0.22em] hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
          Back to dashboard
        </Link>
      </div>
    );
  }

  // ── Transcript data ──
  const transcript = interview.transcript ?? [];
  const filteredTranscript =
    transcriptFilter === 'all'
      ? transcript
      : transcript.filter((e) => e.role === transcriptFilter);

  const candidateInits = initials(interview.candidate_name);
  const st = STATUS_STYLES[interview.status] ?? {
    cls: 'bg-paper-deep text-ink-soft border border-ink/15',
    label: interview.status,
  };
  const hasAssessment = !!interview.assessment;
  const currentRec = interview.recommendation ?? '';
  const recCls = REC_STYLES[currentRec] ?? 'bg-paper-deep text-ink-soft';
  const recLabel = REC_LABELS[currentRec] ?? (currentRec.toUpperCase() || 'PENDING');
  const shortId = interview.id.slice(0, 8).toUpperCase();

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Masthead ── */}
      <section className="mb-10">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft hover:text-ink transition-colors mb-4"
        >
          <ArrowLeft className="w-3 h-3" strokeWidth={2} />
          Back to dashboard
        </Link>

        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Admin · Detail · #INT-{shortId}
          <span
            className={`inline-block px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] ${st.cls}`}
          >
            {st.label}
          </span>
          {currentRec && (
            <span
              className={`inline-block px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] ${recCls}`}
            >
              {recLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-6">
          <h1
            className="font-display font-extrabold tracking-[-0.03em] text-ink"
            style={{ fontSize: 'clamp(40px, 7vw, 80px)', lineHeight: 0.9 }}
          >
            {interview.candidate_name}.
          </h1>

          <div className="flex items-center gap-2 flex-wrap">
            {transcript.length > 0 && (
              <button
                onClick={() => downloadTranscript(interview)}
                className="inline-flex items-center gap-2 bg-paper-deep/60 border border-ink/15 text-ink px-4 py-2 rounded-full font-mono text-[11px] uppercase tracking-[0.22em] hover:bg-ink hover:text-paper transition-colors"
              >
                <Download className="w-3.5 h-3.5" strokeWidth={2} />
                Transcript
              </button>
            )}

            {(interview.status === 'completed' || interview.status === 'assessed') && transcript.length >= 4 && (
              <button
                onClick={handleRunAssessment}
                disabled={assessing}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[11px] uppercase tracking-[0.22em] transition-colors ${
                  assessing
                    ? 'bg-ink/20 text-ink-soft cursor-not-allowed'
                    : hasAssessment
                    ? 'bg-paper-deep/60 border border-ink/15 text-ink hover:bg-ink hover:text-paper'
                    : 'bg-accent text-paper hover:bg-ink'
                }`}
              >
                {assessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                ) : hasAssessment ? (
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
                ) : (
                  <Search className="w-3.5 h-3.5" strokeWidth={2} />
                )}
                {assessing ? 'Processing' : hasAssessment ? 'Re-run' : 'Run assessment'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 max-w-[720px] grid grid-cols-12 gap-4">
          <div className="col-span-12 sm:col-span-3 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft pt-1">
            / Candidate
          </div>
          <p className="col-span-12 sm:col-span-9 font-display text-[17px] leading-[1.45] text-ink-muted tracking-[-0.01em]">
            {interview.candidate_email} · {fmtDate(interview.created_at)} {fmtTime(interview.created_at)} · Duration <span className="tnum text-ink">{fmtDuration(interview.duration_seconds)}</span>
          </p>
        </div>

        <div className="mt-6 h-[1.5px] bg-ink" />
      </section>

      {/* ── Optional hiring composite ── */}
      {interview.hiring_score && hasAssessment && (
        <section className="mb-8">
          <HiringScoreWidget score={interview.hiring_score} />
        </section>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* LEFT — Transcript */}
        <div className="col-span-12 lg:col-span-7 border border-ink/15 rounded-[4px] bg-paper-deep/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-ink/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
              <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.8} />
              / 01 · Transcript
            </div>

            <div className="flex gap-1 bg-paper-deep/60 border border-ink/15 rounded-full p-1">
              {([
                { key: 'all', label: 'Full' },
                { key: 'ai', label: 'AI' },
                { key: 'candidate', label: 'Candidate' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setTranscriptFilter(tab.key)}
                  className={`px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
                    transcriptFilter === tab.key
                      ? 'bg-ink text-paper'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div
            ref={transcriptRef}
            className="p-5 overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 340px)', minHeight: 300 }}
          >
            {transcript.length === 0 ? (
              <div className="text-center py-10 px-5">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-paper-deep border border-ink/15 mb-3">
                  <MessageCircle className="w-4 h-4 text-ink-soft" strokeWidth={1.8} />
                </div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
                  Interview not yet completed
                </p>
              </div>
            ) : filteredTranscript.length === 0 ? (
              <div className="text-center py-10 px-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
                  No messages from this speaker
                </p>
              </div>
            ) : (
              (() => {
                let lastPhase: InterviewPhase | '' = '';
                return filteredTranscript.map((entry, i) => {
                  const showDivider = entry.phase !== lastPhase;
                  lastPhase = entry.phase;
                  return (
                    <div key={i}>
                      {showDivider && <PhaseDivider phase={entry.phase} />}
                      <ChatBubble entry={entry} candidateInitials={candidateInits} />
                    </div>
                  );
                });
              })()
            )}
          </div>
        </div>

        {/* RIGHT — Assessment + controls */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-5">
          {/* Assessment */}
          <div className="border border-ink/15 rounded-[4px] bg-paper-deep/40 overflow-hidden">
            <div className="px-5 py-4 border-b border-ink/10 flex items-center gap-2">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
                <FileText className="w-3.5 h-3.5" strokeWidth={1.8} />
                / 02 · Assessment
              </div>
            </div>
            <div className="p-5">
              {hasAssessment ? (
                <>
                  <AssessmentView assessment={interview.assessment!} />
                  {(interview.speech_analytics && interview.integrity_report && interview.interview_quality) && (
                    <DeepIntelligenceView
                      speech={interview.speech_analytics}
                      integrity={interview.integrity_report}
                      quality={interview.interview_quality}
                    />
                  )}
                </>
              ) : interview.status === 'completed' ? (
                <div className="text-center py-10 px-5">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border-[2px] border-ink/15 border-t-accent animate-spin mb-4" />
                  <p className="font-display text-[15px] font-semibold text-ink tracking-[-0.01em] mb-1">
                    Assessment in progress
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                    Auto-refreshing every 5 seconds
                  </p>
                </div>
              ) : (
                <div className="text-center py-10 px-5">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-paper-deep border border-ink/15 mb-3">
                    <Sparkles className="w-4 h-4 text-ink-soft" strokeWidth={1.8} />
                  </div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft mb-5">
                    Assessment pending
                  </p>
                  {transcript.length >= 4 && (
                    <button
                      onClick={handleRunAssessment}
                      disabled={assessing}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-mono text-[11px] uppercase tracking-[0.22em] transition-colors ${
                        assessing
                          ? 'bg-ink/20 text-ink-soft cursor-not-allowed'
                          : 'bg-accent text-paper hover:bg-ink'
                      }`}
                    >
                      {assessing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                      ) : (
                        <Search className="w-3.5 h-3.5" strokeWidth={2} />
                      )}
                      {assessing ? 'Running' : 'Run assessment'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Reviewer notes */}
          <div className="border border-ink/15 rounded-[4px] bg-paper-deep/40 p-5">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-3">
              <StickyNote className="w-3.5 h-3.5" strokeWidth={1.8} />
              / 03 · Reviewer notes
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes about this candidate…"
              rows={4}
              className="w-full px-3 py-2.5 rounded-[4px] font-display text-[14px] text-ink bg-paper border border-ink/15 outline-none resize-y transition-colors focus:border-ink placeholder:text-ink-soft"
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[11px] uppercase tracking-[0.22em] transition-colors ${
                  savingNotes
                    ? 'bg-ink/20 text-ink-soft cursor-not-allowed'
                    : 'bg-ink text-paper hover:bg-accent'
                }`}
              >
                {savingNotes ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <Check className="w-3.5 h-3.5" strokeWidth={2} />
                )}
                {savingNotes ? 'Saving' : 'Save notes'}
              </button>
              {notesSaved && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.22em] text-ink">
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
                  Saved
                </span>
              )}
            </div>
          </div>

          {/* Override */}
          {hasAssessment && (
            <div className="border border-ink/15 rounded-[4px] bg-paper-deep/40 p-5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.8} />
                / 04 · Override
              </div>
              <p className="font-display text-[13px] text-ink-muted leading-[1.5] mb-4">
                Manually change the AI&apos;s recommendation
              </p>
              <select
                value={overrideRec}
                onChange={(e) => setOverrideRec(e.target.value)}
                className="w-full px-3 py-2.5 rounded-[4px] font-display text-[14px] text-ink bg-paper border border-ink/15 outline-none mb-3 focus:border-ink"
              >
                <option value="strong_pass">Strong Pass</option>
                <option value="pass">Pass</option>
                <option value="borderline">Borderline</option>
                <option value="fail">Fail</option>
              </select>
              {overrideRec !== interview.recommendation && (
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Reason for override (required)"
                  className="w-full px-3 py-2.5 rounded-[4px] font-display text-[14px] text-ink bg-paper border border-ink/15 outline-none mb-3 focus:border-ink placeholder:text-ink-soft"
                />
              )}
              <button
                onClick={handleSaveOverride}
                disabled={savingOverride || overrideRec === interview.recommendation}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[11px] uppercase tracking-[0.22em] transition-colors ${
                  savingOverride || overrideRec === interview.recommendation
                    ? 'bg-ink/20 text-ink-soft cursor-not-allowed'
                    : 'bg-ink text-paper hover:bg-accent'
                }`}
              >
                {savingOverride ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <Check className="w-3.5 h-3.5" strokeWidth={2} />
                )}
                {savingOverride ? 'Saving' : 'Save override'}
              </button>
            </div>
          )}

          {/* Mark reviewed */}
          <div className="border border-ink/15 rounded-[4px] bg-paper-deep/40 p-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={handleToggleReviewed}
                className="w-4 h-4 accent-ink cursor-pointer"
              />
              <ShieldCheck className="w-4 h-4 text-ink-soft" strokeWidth={1.8} />
              <span className="font-display text-[14px] text-ink tracking-[-0.005em] flex-1">
                Mark as reviewed
              </span>
              {reviewed && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink">
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
                  Reviewed
                </span>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* ── Audio ── */}
      <section className="border border-ink/15 rounded-[4px] bg-paper-deep/40 p-6 mt-6 mb-10">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-4">
          <Play className="w-3.5 h-3.5" strokeWidth={1.8} />
          / 05 · Audio recording
        </div>
        {interview.audio_url ? (
          <AudioPlayer src={interview.audio_url} />
        ) : (
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
            Audio recording not available for this interview
          </p>
        )}
      </section>
    </div>
  );
}
