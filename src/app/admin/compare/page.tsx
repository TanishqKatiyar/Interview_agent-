'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getInterviewById } from '@/lib/supabase';
import type { Interview, Assessment } from '@/lib/types';
import { ArrowLeft, BrainCircuit, Radar, Check, TrendingUp, Compass, Target, ClipboardList, Heart, RefreshCw } from 'lucide-react';

// Tokyo palette for up to 3 overlay candidates
const CANDIDATE_COLORS = [
  { stroke: '#1C0F09', fill: 'rgba(28, 15, 9, 0.18)' }, // ink
  { stroke: '#D63426', fill: 'rgba(214, 52, 38, 0.22)' }, // accent
  { stroke: '#E8823A', fill: 'rgba(232, 130, 58, 0.22)' }, // tangerine
];

const DIMENSION_KEYS: (keyof Assessment['dimensions'])[] = [
  'communication_clarity',
  'simplification_ability',
  'patience_indicators',
  'warmth_and_rapport',
  'english_fluency',
];

const DIMENSION_LABELS: Record<string, string> = {
  communication_clarity: 'Communication',
  simplification_ability: 'Teaching',
  patience_indicators: 'Patience',
  warmth_and_rapport: 'Warmth',
  english_fluency: 'Fluency',
};

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

const PERSONA_ICON: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  patient_guide: Compass,
  enthusiastic_explainer: Target,
  structured_coach: ClipboardList,
  empathetic_mentor: Heart,
};

// ─── Radar helpers ────────────────────────────────────────────────────────────
function calculatePolygonPoints(
  scores: number[],
  centerX: number,
  centerY: number,
  radius: number
): string {
  return scores
    .map((score, i) => {
      const normalizedScore = Math.max(0, (score - 1) / 4);
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * (radius * normalizedScore);
      const y = centerY + Math.sin(angle) * (radius * normalizedScore);
      return `${x},${y}`;
    })
    .join(' ');
}

function RadarChart({ candidates }: { candidates: Interview[] }) {
  const size = 340;
  const center = size / 2;
  const maxRadius = 110;

  const gridPolygons = [1, 2, 3, 4, 5].map((level) => {
    const points = calculatePolygonPoints(Array(5).fill(level), center, center, maxRadius);
    return (
      <polygon
        key={level}
        points={points}
        fill="none"
        stroke="#1C0F09"
        strokeOpacity={0.14}
        strokeWidth={1}
        strokeDasharray={level < 5 ? '3,4' : 'none'}
      />
    );
  });

  const axes = DIMENSION_KEYS.map((_, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const x2 = center + Math.cos(angle) * maxRadius;
    const y2 = center + Math.sin(angle) * maxRadius;
    return (
      <line
        key={i}
        x1={center}
        y1={center}
        x2={x2}
        y2={y2}
        stroke="#1C0F09"
        strokeOpacity={0.14}
        strokeWidth={1}
      />
    );
  });

  const labels = DIMENSION_KEYS.map((key, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const offset = 26;
    const x = center + Math.cos(angle) * (maxRadius + offset);
    const y = center + Math.sin(angle) * (maxRadius + offset);
    let textAnchor: 'middle' | 'start' | 'end' = 'middle';
    if (x < center - 10) textAnchor = 'end';
    if (x > center + 10) textAnchor = 'start';
    return (
      <text
        key={key}
        x={x}
        y={y}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        fontSize={10}
        fontFamily="var(--font-geist-mono)"
        letterSpacing="0.18em"
        fill="#1C0F09"
        fillOpacity={0.7}
      >
        {DIMENSION_LABELS[key].toUpperCase()}
      </text>
    );
  });

  const overlays = candidates.map((c, idx) => {
    if (!c.assessment) return null;
    const color = CANDIDATE_COLORS[idx % CANDIDATE_COLORS.length];
    const scores = DIMENSION_KEYS.map((k) => c.assessment!.dimensions[k].score);
    const points = calculatePolygonPoints(scores, center, center, maxRadius);
    return (
      <polygon
        key={c.id}
        points={points}
        fill={color.fill}
        stroke={color.stroke}
        strokeWidth={1.5}
        style={{ mixBlendMode: 'multiply' }}
      />
    );
  });

  return (
    <div className="relative w-full max-w-[340px] mx-auto">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto">
        {gridPolygons}
        {axes}
        {labels}
        {overlays}
      </svg>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function CompareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idsStr = searchParams.get('ids');

  const [candidates, setCandidates] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  useEffect(() => {
    async function load() {
      if (!idsStr) {
        setError('No candidate IDs provided for comparison.');
        setLoading(false);
        return;
      }
      const ids = idsStr.split(',').slice(0, 3);
      try {
        const fetched = await Promise.all(ids.map((id) => getInterviewById(id)));
        const valid = fetched.filter((i): i is Interview => i !== null && !!i.assessment);
        if (valid.length < 2) {
          setError('Need at least 2 fully assessed candidates to compare.');
        } else {
          setCandidates(valid);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Failed to fetch candidate data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [idsStr]);

  useEffect(() => {
    if (candidates.length < 2 || aiSummary || generatingAi) return;

    async function getSummary() {
      setGeneratingAi(true);
      try {
        const payload = candidates.map((c) => ({
          name: c.candidate_name,
          summary: c.assessment!.summary,
        }));

        const res = await fetch('/api/interviews/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidates: payload }),
        });

        if (res.ok) {
          const data = await res.json();
          setAiSummary(data.summary);
        } else {
          setAiSummary('Comparison generation failed.');
        }
      } catch {
        setAiSummary('Comparison generation failed.');
      } finally {
        setGeneratingAi(false);
      }
    }

    getSummary();
  }, [candidates, aiSummary, generatingAi]);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-soft">
          / Loading candidates
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[640px] mx-auto py-20 px-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent mb-3">
          / Error
        </div>
        <p className="font-display text-[22px] text-ink tracking-[-0.02em] mb-6">{error}</p>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 bg-ink text-paper px-5 py-2.5 rounded-full font-mono text-[11px] uppercase tracking-[0.22em] hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
          Go back
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Masthead */}
      <section className="mb-10">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft hover:text-ink transition-colors mb-4"
        >
          <ArrowLeft className="w-3 h-3" strokeWidth={2} />
          Back to dashboard
        </button>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Admin · Compare · #CMP-{candidates.length}
        </div>
        <h1
          className="font-display font-extrabold tracking-[-0.03em] text-ink"
          style={{ fontSize: 'clamp(44px, 8vw, 96px)', lineHeight: 0.9 }}
        >
          Compare.
        </h1>
        <div className="mt-4 max-w-[620px] grid grid-cols-12 gap-4">
          <div className="col-span-12 sm:col-span-3 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft pt-1">
            / Candidates
          </div>
          <p className="col-span-12 sm:col-span-9 font-display text-[17px] leading-[1.45] text-ink-muted tracking-[-0.01em]">
            Side-by-side diagnostic — {candidates.length} candidates across {DIMENSION_KEYS.length} dimensions, with an AI narrative.
          </p>
        </div>
        <div className="mt-6 h-[1.5px] bg-ink" />
      </section>

      {/* Candidate columns */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
        {candidates.map((c, idx) => {
          const color = CANDIDATE_COLORS[idx % CANDIDATE_COLORS.length];
          const score = c.overall_score?.toFixed(1) ?? '—';
          const rec = c.recommendation ?? 'fail';
          const p = c.assessment!.teaching_persona;
          const PIcon = p?.type ? PERSONA_ICON[p.type] || RefreshCw : RefreshCw;

          return (
            <div
              key={c.id}
              className="relative border border-ink/15 rounded-[4px] bg-paper-deep/40 p-6 overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 w-full h-[3px]"
                style={{ background: color.stroke }}
              />
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2 mt-1">
                / {String.fromCharCode(65 + idx)} · {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink leading-tight mb-5">
                {c.candidate_name}
              </h2>

              <div className="flex items-baseline gap-2 mb-5">
                <span
                  className="font-display font-extrabold text-ink tracking-[-0.02em] tnum"
                  style={{ fontSize: 'clamp(40px, 5vw, 56px)', lineHeight: 1 }}
                >
                  {score}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
                  / 5.0
                </span>
              </div>

              <div className="space-y-3">
                <span
                  className={`inline-block px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] ${REC_STYLES[rec]}`}
                >
                  {REC_LABELS[rec]}
                </span>

                {p && (
                  <div className="border border-ink/15 rounded-[4px] p-3 flex items-center gap-3 bg-paper/60">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-ink text-paper shrink-0">
                      <PIcon className="w-3.5 h-3.5" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-[13px] font-semibold text-ink tracking-[-0.01em] truncate">
                        {p.label}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft truncate">
                        {p.best_for}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Radar + AI narrative */}
      <section className="grid grid-cols-12 gap-4 sm:gap-6 mb-8">
        <div className="col-span-12 lg:col-span-6 border border-ink/15 rounded-[4px] bg-paper-deep/40 p-6">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
            <Radar className="w-3.5 h-3.5" strokeWidth={1.8} />
            / 01 · Overlay
          </div>
          <h3 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-ink mb-6">
            Dimension overlay
          </h3>
          <RadarChart candidates={candidates} />
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-6">
            {candidates.map((c, idx) => {
              const color = CANDIDATE_COLORS[idx % CANDIDATE_COLORS.length];
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: color.stroke }}
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
                    {c.candidate_name.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 relative border border-ink/15 rounded-[4px] bg-accent text-paper p-6 overflow-hidden">
          <span className="corner-bl" aria-hidden />
          <span className="corner-br" aria-hidden />
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-paper/70 mb-1">
            <BrainCircuit className="w-3.5 h-3.5" strokeWidth={2} />
            / 02 · Analysis
          </div>
          <h3 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-paper mb-5">
            AI comparison
          </h3>

          {generatingAi ? (
            <div className="flex flex-col gap-3 animate-pulse">
              <div className="h-3 bg-paper/25 rounded w-full" />
              <div className="h-3 bg-paper/25 rounded w-11/12" />
              <div className="h-3 bg-paper/25 rounded w-4/5" />
              <div className="h-3 bg-paper/25 rounded w-full mt-2" />
              <div className="h-3 bg-paper/25 rounded w-3/4" />
            </div>
          ) : (
            <p className="font-display text-[16px] leading-[1.55] tracking-[-0.005em] text-paper whitespace-pre-wrap">
              {aiSummary}
            </p>
          )}
        </div>
      </section>

      {/* Dimension matrix */}
      <section className="border border-ink/15 rounded-[4px] bg-paper-deep/40 mb-8 overflow-hidden">
        <div className="px-6 py-5 border-b border-ink/10">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
            / 03 · Matrix
          </div>
          <h3 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-ink">
            Dimension scorecard
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="px-6 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                  / Dimension
                </th>
                {candidates.map((c, idx) => {
                  const color = CANDIDATE_COLORS[idx % CANDIDATE_COLORS.length];
                  return (
                    <th
                      key={c.id}
                      className="px-6 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink"
                    >
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: color.stroke }}
                        />
                        {c.candidate_name.split(' ')[0]}
                      </span>
                    </th>
                  );
                })}
                <th className="px-6 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-accent bg-accent/5 border-l border-ink/10">
                  / Winner
                </th>
              </tr>
            </thead>
            <tbody>
              {DIMENSION_KEYS.map((key) => {
                let maxScore = -1;
                let winnerIds: string[] = [];
                candidates.forEach((c) => {
                  const s = c.assessment!.dimensions[key].score;
                  if (s > maxScore) {
                    maxScore = s;
                    winnerIds = [c.id];
                  } else if (s === maxScore) {
                    winnerIds.push(c.id);
                  }
                });

                return (
                  <tr key={key} className="border-b border-ink/10 last:border-b-0">
                    <td className="px-6 py-4 font-display text-[14px] font-medium text-ink tracking-[-0.005em]">
                      {DIMENSION_LABELS[key]}
                    </td>
                    {candidates.map((c) => {
                      const score = c.assessment!.dimensions[key].score;
                      const isWinner = winnerIds.includes(c.id);
                      return (
                        <td key={c.id} className="px-6 py-4">
                          <span
                            className={
                              'font-mono text-[14px] tnum ' +
                              (isWinner ? 'font-bold text-ink' : 'text-ink-soft')
                            }
                          >
                            {score.toFixed(1)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 font-display text-[14px] font-semibold text-ink bg-accent/5 border-l border-ink/10 tracking-[-0.005em]">
                      {winnerIds.length === candidates.length
                        ? 'Tie'
                        : candidates
                            .filter((c) => winnerIds.includes(c.id))
                            .map((c) => c.candidate_name.split(' ')[0])
                            .join(', ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pros & Cons */}
      <section className="mb-16">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-4">
          <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.8} />
          / 04 · Pros & cons
        </div>
        <h3 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink mb-5">
          Strengths and growth areas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {candidates.map((c, idx) => {
            const color = CANDIDATE_COLORS[idx % CANDIDATE_COLORS.length];
            return (
              <div key={c.id} className="border border-ink/15 rounded-[4px] bg-paper-deep/40 p-6">
                <h4
                  className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink inline-block pb-2 mb-5 border-b-[2px]"
                  style={{ borderBottomColor: color.stroke }}
                >
                  {c.candidate_name.split(' ')[0]}
                </h4>

                <div className="mb-6">
                  <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-3">
                    / Top strengths
                  </div>
                  <ul className="space-y-2">
                    {c.assessment!.strengths.slice(0, 3).map((s, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 font-display text-[14px] text-ink leading-[1.5] tracking-[-0.005em]"
                      >
                        <Check className="w-3.5 h-3.5 text-ink shrink-0 mt-1" strokeWidth={2.5} />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent mb-3">
                    / Growth areas
                  </div>
                  <ul className="space-y-2">
                    {c.assessment!.areas_for_improvement.slice(0, 3).map((s, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 font-display text-[14px] text-ink leading-[1.5] tracking-[-0.005em]"
                      >
                        <span className="text-accent shrink-0 mt-0.5 font-mono font-bold">↗</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center font-mono text-[11px] uppercase tracking-[0.28em] text-ink-soft">
          / Loading
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
