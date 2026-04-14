'use client';

import { useState } from 'react';
import type { Assessment, TeachingPersona } from '@/lib/types';
import {
  Check,
  AlertTriangle,
  Compass,
  Target,
  ClipboardList,
  Heart,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Quote,
} from 'lucide-react';

// ─── Dimension display names ────────────────────────────────────────────────

const DIMENSION_LABELS: Record<string, string> = {
  communication_clarity: 'Communication Clarity',
  warmth_and_rapport: 'Warmth & Rapport',
  simplification_ability: 'Simplification Ability',
  patience_indicators: 'Patience',
  english_fluency: 'English Fluency',
};

const DIMENSION_ORDER = [
  'communication_clarity',
  'warmth_and_rapport',
  'simplification_ability',
  'patience_indicators',
  'english_fluency',
] as const;

// ─── Tonal helpers ──────────────────────────────────────────────────────────

function overallScoreColor(score: number): string {
  if (score >= 3.5) return 'text-ink';
  if (score >= 3.0) return 'text-tangerine';
  return 'text-accent';
}

function barTone(score: number): string {
  if (score >= 3.5) return 'bg-ink';
  if (score >= 2.5) return 'bg-tangerine';
  return 'bg-accent';
}

function barTextTone(score: number): string {
  if (score >= 3.5) return 'text-ink';
  if (score >= 2.5) return 'text-tangerine';
  return 'text-accent';
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

// ─── Persona icon map ───────────────────────────────────────────────────────

const PERSONA_ICON: Record<
  string,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  patient_guide: Compass,
  enthusiastic_explainer: Target,
  structured_coach: ClipboardList,
  empathetic_mentor: Heart,
  adaptive_solver: RefreshCw,
};

function PersonaCard({ persona }: { persona: TeachingPersona }) {
  const Icon = PERSONA_ICON[persona.type] ?? Compass;
  return (
    <div className="border border-ink/15 rounded-[4px] bg-paper-deep/60 p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-ink text-paper shrink-0">
          <Icon className="w-4 h-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
            / Teaching persona
          </div>
          <h4 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink truncate">
            {persona.label}
          </h4>
        </div>
      </div>
      <p className="font-display text-[14px] leading-[1.55] tracking-[-0.005em] text-ink mb-3">
        {persona.description}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
        / Best for · <span className="text-ink">{persona.best_for}</span>
      </p>
    </div>
  );
}

// ─── DimensionRow ───────────────────────────────────────────────────────────

function DimensionRow({
  dimKey,
  dim,
}: {
  dimKey: string;
  dim: { score: number; evidence: string[]; reasoning: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = (dim.score / 5) * 100;
  const label = DIMENSION_LABELS[dimKey] ?? dimKey;
  const hasDetails = dim.evidence.length > 0 || (dim.reasoning && dim.reasoning.length > 0);

  return (
    <div className="pb-4 border-b border-ink/10 last:border-b-0">
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-display text-[14px] font-medium text-ink tracking-[-0.005em]">
          {label}
        </span>
        <span className={`font-mono text-[13px] tnum font-semibold ${barTextTone(dim.score)}`}>
          {dim.score.toFixed(1)}
          <span className="ml-1 text-ink-soft font-normal">/ 5.0</span>
        </span>
      </div>

      <div className="h-[6px] bg-ink/10 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${barTone(dim.score)} rounded-full transition-[width] duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {hasDetails && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft hover:text-ink transition-colors"
          aria-expanded={expanded}
          aria-controls={`evidence-${dimKey}`}
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3" strokeWidth={2} />
          ) : (
            <ChevronRight className="w-3 h-3" strokeWidth={2} />
          )}
          {expanded ? 'Hide evidence' : 'See evidence'}
        </button>
      )}

      <div
        id={`evidence-${dimKey}`}
        style={{
          overflow: 'hidden',
          maxHeight: expanded ? 600 : 0,
          transition: 'max-height 0.35s ease',
        }}
      >
        <div className="pt-3 flex flex-col gap-3">
          {dim.evidence.length > 0 && (
            <div className="flex flex-col gap-2">
              {dim.evidence.map((quote, qi) => (
                <p
                  key={qi}
                  className="font-display text-[13px] italic text-ink-muted leading-[1.55] pl-3 border-l-2 border-ink/20"
                >
                  &ldquo;{quote}&rdquo;
                </p>
              ))}
            </div>
          )}
          {dim.reasoning && (
            <p className="font-display text-[14px] leading-[1.55] tracking-[-0.005em] text-ink">
              {dim.reasoning}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AssessmentView — main
// ═════════════════════════════════════════════════════════════════════════════

interface AssessmentViewProps {
  assessment: Assessment;
}

export default function AssessmentView({ assessment }: AssessmentViewProps) {
  const recCls = REC_STYLES[assessment.recommendation] ?? 'bg-paper-deep text-ink-soft';
  const recLabel = REC_LABELS[assessment.recommendation] ?? assessment.recommendation;
  const scoreToneCls = overallScoreColor(assessment.overall_score);

  return (
    <div className="flex flex-col gap-7">
      {/* ── OVERALL ── */}
      <div className="text-center pb-6 border-b border-ink/10">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-3">
          / Overall score
        </div>
        <div
          className={`font-display font-extrabold tracking-[-0.03em] tnum leading-none ${scoreToneCls}`}
          style={{ fontSize: 'clamp(48px, 7vw, 72px)' }}
        >
          {assessment.overall_score.toFixed(1)}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mt-2 mb-5">
          out of 5.0
        </div>

        <span
          className={`inline-block px-4 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] ${recCls}`}
        >
          {recLabel}
        </span>

        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mt-4">
          Confidence · <span className="text-ink capitalize">{assessment.confidence}</span>
        </div>
      </div>

      {/* ── TEACHING PERSONA ── */}
      {assessment.teaching_persona && <PersonaCard persona={assessment.teaching_persona} />}

      {/* ── RED FLAGS ── */}
      {assessment.red_flags.length > 0 && (
        <div className="relative border border-ink/15 rounded-[4px] bg-accent text-paper p-5 overflow-hidden">
          <span className="corner-bl" aria-hidden />
          <span className="corner-br" aria-hidden />
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-paper/80 mb-3">
            <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} />
            / Red flags
          </div>
          <ul className="flex flex-col gap-1.5">
            {assessment.red_flags.map((flag, i) => (
              <li
                key={i}
                className="font-display text-[14px] leading-[1.5] tracking-[-0.005em] text-paper flex gap-2"
              >
                <span>—</span>
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── DIMENSIONS ── */}
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-4">
          <Quote className="w-3.5 h-3.5" strokeWidth={1.8} />
          / Dimension scores
        </div>
        <div className="flex flex-col gap-4">
          {DIMENSION_ORDER.map((key) => {
            const dim = assessment.dimensions[key as keyof typeof assessment.dimensions];
            if (!dim) return null;
            return <DimensionRow key={key} dimKey={key} dim={dim} />;
          })}
        </div>
      </div>

      {/* ── STRENGTHS / IMPROVEMENTS ── */}
      {(assessment.strengths.length > 0 || assessment.areas_for_improvement.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-ink/10 pt-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-3">
              / Strengths
            </div>
            <div className="flex flex-wrap gap-2">
              {assessment.strengths.map((s, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ink text-paper font-display text-[12px] tracking-[-0.005em]"
                >
                  <Check className="w-3 h-3" strokeWidth={2.5} />
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent mb-3">
              / Growth areas
            </div>
            <div className="flex flex-wrap gap-2">
              {assessment.areas_for_improvement.map((a, i) => (
                <span
                  key={i}
                  className="inline-block px-3 py-1 rounded-full bg-sunshine text-ink font-display text-[12px] tracking-[-0.005em]"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SUMMARY ── */}
      {assessment.summary && (
        <div className="border-t border-ink/10 pt-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-3">
            / Summary
          </div>
          <p className="font-display text-[15px] leading-[1.65] tracking-[-0.005em] text-ink whitespace-pre-line">
            {assessment.summary}
          </p>
        </div>
      )}
    </div>
  );
}
