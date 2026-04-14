'use client';

import type { TranscriptEntry, InterviewPhase } from '@/lib/types';

const PHASE_LABELS: Record<InterviewPhase, string> = {
  GREETING: 'Greeting',
  WARM_UP: 'Warm-up',
  CORE_ASSESSMENT: 'Core Assessment',
  SCENARIO: 'Role-play Scenario',
  WRAP_UP: 'Wrap-up',
  ENDED: 'Ended',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface TranscriptViewProps {
  transcript: TranscriptEntry[];
}

export default function TranscriptView({ transcript }: TranscriptViewProps) {
  let lastPhase: InterviewPhase | null = null;

  if (transcript.length === 0) {
    return (
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft py-6">
        / No transcript available
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {transcript.map((entry, i) => {
        const showDivider = entry.phase !== lastPhase;
        lastPhase = entry.phase;
        const isAi = entry.role === 'ai';

        return (
          <div key={i}>
            {/* Phase divider */}
            {showDivider && (
              <div className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px bg-ink/15" />
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
                  / {PHASE_LABELS[entry.phase]}
                </span>
                <div className="flex-1 h-px bg-ink/15" />
              </div>
            )}

            {/* Message row */}
            <div className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
              <div className="max-w-[85%]">
                <div
                  className={`font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-1 ${
                    isAi ? 'text-left' : 'text-right'
                  }`}
                >
                  {isAi ? 'Interviewer' : 'Candidate'} · {formatTime(entry.timestamp)}
                </div>

                <div
                  className={`px-4 py-2.5 rounded-[4px] font-display text-[14px] leading-[1.55] tracking-[-0.005em] ${
                    isAi
                      ? 'bg-paper-deep border border-ink/15 text-ink'
                      : 'bg-ink text-paper'
                  }`}
                >
                  {entry.content}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
