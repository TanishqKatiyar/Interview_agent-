'use client';

import { useState } from 'react';
import type { HiringScore } from '@/lib/types';
import { ChevronDown, ChevronUp, Gauge } from 'lucide-react';

const REC_STYLES: Record<string, { cls: string; label: string }> = {
  strong_hire: { cls: 'bg-ink text-paper', label: 'Strong Hire' },
  hire: { cls: 'bg-tangerine text-ink', label: 'Hire' },
  maybe: { cls: 'bg-sunshine text-ink', label: 'Maybe' },
  pass: { cls: 'bg-accent text-paper', label: 'Pass' },
};

export default function HiringScoreWidget({ score }: { score: HiringScore }) {
  const [expanded, setExpanded] = useState(false);

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score.composite / 100) * circumference;

  const gaugeColor = (val: number) => {
    if (val >= 80) return '#1C0F09'; // ink
    if (val >= 65) return '#E8823A'; // tangerine
    if (val >= 50) return '#E8B840'; // sunshine
    return '#D63426'; // accent
  };

  const confColorClass =
    score.confidence >= 70
      ? 'bg-ink'
      : score.confidence >= 40
      ? 'bg-tangerine'
      : 'bg-accent';

  const rec = REC_STYLES[score.recommendation] ?? REC_STYLES.maybe;

  const completionTone =
    score.breakdown.completionMultiplier < 0.8 ? 'text-accent' : 'text-ink';
  const integrityTone =
    score.breakdown.integrityPenalty > 0 ? 'text-accent' : 'text-ink';
  const difficultyTone =
    score.breakdown.adaptiveDifficultyBonus > 0 ? 'text-tangerine' : 'text-ink';

  return (
    <div className="border border-ink/15 rounded-[4px] bg-paper-deep/40 p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2">
            <Gauge className="w-3.5 h-3.5" strokeWidth={1.8} />
            / Composite
          </div>
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink flex items-center gap-3">
            Hiring composite score
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-paper-deep border border-ink/15 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
              {score.percentile}
            </span>
          </h2>
          <p className="font-display text-[14px] text-ink-muted leading-[1.5] mt-1.5">
            A weighted evaluation of performance, integrity, and signal quality.
          </p>
        </div>

        <span
          className={`inline-block px-4 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] ${rec.cls}`}
        >
          {rec.label}
        </span>
      </div>

      {/* Gauge + stats */}
      <div className="flex flex-wrap items-center gap-8">
        {/* Circular gauge */}
        <div className="relative w-[120px] h-[120px] flex items-center justify-center shrink-0">
          <svg
            width="120"
            height="120"
            viewBox="0 0 100 100"
            style={{ transform: 'rotate(-90deg)' }}
          >
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#1C0F09"
              strokeOpacity={0.1}
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke={gaugeColor(score.composite)}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
          </svg>
          <div className="absolute text-center">
            <div className="font-display font-extrabold text-ink tracking-[-0.02em] tnum text-[32px] leading-none">
              {score.composite}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mt-1">
              / 100
            </div>
          </div>
        </div>

        {/* Supporting stats */}
        <div className="flex flex-col gap-4 min-w-[220px] flex-1">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2">
              / Confidence · {score.confidence}%
            </div>
            <div className="h-[6px] bg-ink/10 rounded-full overflow-hidden">
              <div
                className={`h-full ${confColorClass} rounded-full transition-[width] duration-700`}
                style={{ width: `${score.confidence}%` }}
              />
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2">
              / Predicted bound range
            </div>
            <div className="flex items-center gap-3">
              <span className="font-display text-[16px] font-semibold text-ink tnum tracking-[-0.01em]">
                {score.range.low}
              </span>
              <div className="relative flex-1 h-[4px] bg-ink/10 rounded-full">
                <div
                  className="absolute h-full bg-ink rounded-full"
                  style={{
                    left: `${score.range.low}%`,
                    right: `${100 - score.range.high}%`,
                  }}
                />
              </div>
              <span className="font-display text-[16px] font-semibold text-ink tnum tracking-[-0.01em]">
                {score.range.high}
              </span>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mt-2">
              Likely range (theoretical)
            </p>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="border-t border-ink/10 pt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft hover:text-ink transition-colors"
        >
          <span>/ Formula breakdown</span>
          {expanded ? <ChevronUp className="w-4 h-4" strokeWidth={2} /> : <ChevronDown className="w-4 h-4" strokeWidth={2} />}
        </button>

        {expanded && (
          <div className="mt-4 border border-ink/10 rounded-[4px] p-5 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4 bg-paper/60">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-1">
                / Base rubric
              </div>
              <div className="font-display text-[17px] font-semibold text-ink tnum tracking-[-0.01em]">
                {score.breakdown.baseScore}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-1">
                / Completion
              </div>
              <div className={`font-display text-[17px] font-semibold tnum tracking-[-0.01em] ${completionTone}`}>
                {score.breakdown.completionMultiplier}x
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-1">
                / Signal bonus
              </div>
              <div className="font-display text-[17px] font-semibold text-ink tnum tracking-[-0.01em]">
                +{score.breakdown.signalBonus}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-1">
                / Integrity penalty
              </div>
              <div className={`font-display text-[17px] font-semibold tnum tracking-[-0.01em] ${integrityTone}`}>
                −{score.breakdown.integrityPenalty}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-1">
                / Difficulty scaler
              </div>
              <div className={`font-display text-[17px] font-semibold tnum tracking-[-0.01em] ${difficultyTone}`}>
                +{score.breakdown.adaptiveDifficultyBonus}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
