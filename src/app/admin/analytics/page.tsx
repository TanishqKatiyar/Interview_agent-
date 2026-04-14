'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { listInterviews } from '@/lib/supabase';
import type { Interview } from '@/lib/types';
import { TrendingUp, PieChart, BarChart3, Trophy, AlertTriangle, Sparkles } from 'lucide-react';

type DateRange = '7d' | '30d' | '90d' | 'all';

const RANGE_LABELS: Record<DateRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  all: 'All time',
};

function rangeCutoff(range: DateRange): Date | null {
  if (range === 'all') return null;
  const d = new Date();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Tokyo palette mapping for recommendations
const REC_COLORS: Record<string, string> = {
  strong_pass: '#1C0F09', // ink
  pass: '#E8823A', // tangerine
  borderline: '#E8B840', // sunshine
  fail: '#D63426', // accent red
};

const REC_LABELS: Record<string, string> = {
  strong_pass: 'Strong Pass',
  pass: 'Pass',
  borderline: 'Borderline',
  fail: 'Fail',
};

const DIMENSION_LABELS: Record<string, string> = {
  communication_clarity: 'Communication Clarity',
  warmth_and_rapport: 'Warmth & Rapport',
  simplification_ability: 'Simplification Ability',
  patience_indicators: 'Patience',
  english_fluency: 'English Fluency',
};

// ─── Area Chart ───────────────────────────────────────────────────────────────
function AreaChart({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) {
    return <EmptyChart label="No interview data for this period" />;
  }

  const W = 500;
  const H = 240;
  const PAD = { top: 16, right: 16, bottom: 36, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const yMax = Math.ceil(maxCount * 1.2) || 1;

  const points = data.map((d, i) => ({
    x: PAD.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
    y: PAD.top + chartH - (d.count / yMax) * chartH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD.top + chartH} L${points[0].x},${PAD.top + chartH} Z`;

  const yTicks = [0, Math.round(yMax / 2), yMax];
  const step = Math.max(1, Math.floor(data.length / 7));
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {yTicks.map((v) => {
        const y = PAD.top + chartH - (v / yMax) * chartH;
        return (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1C0F09" strokeOpacity={0.08} strokeWidth={1} />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="#1C0F09" fillOpacity={0.55} fontSize={10} fontFamily="var(--font-geist-mono)">
              {v}
            </text>
          </g>
        );
      })}

      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D63426" stopOpacity={0.25} />
          <stop offset="100%" stopColor="#D63426" stopOpacity={0.02} />
        </linearGradient>
      </defs>

      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={linePath} fill="none" stroke="#D63426" strokeWidth={2} strokeLinejoin="round" />

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="#D63426" />
          <circle cx={p.x} cy={p.y} r={10} fill="transparent">
            <title>{fmtDate(p.date)}: {p.count} interview{p.count !== 1 ? 's' : ''}</title>
          </circle>
        </g>
      ))}

      {xLabels.map((d) => {
        const idx = data.indexOf(d);
        const x = PAD.left + (data.length === 1 ? chartW / 2 : (idx / (data.length - 1)) * chartW);
        return (
          <text key={d.date} x={x} y={H - 8} textAnchor="middle" fill="#1C0F09" fillOpacity={0.55} fontSize={10} fontFamily="var(--font-geist-mono)">
            {fmtDate(d.date)}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart({ distribution }: { distribution: { key: string; count: number }[] }) {
  const total = distribution.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <EmptyChart label="No assessed interviews yet" />;
  }

  const SIZE = 200;
  const R = 70;
  const STROKE = 24;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const CIRC = 2 * Math.PI * R;

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#1C0F09" strokeOpacity={0.08} strokeWidth={STROKE} />
        {distribution.map((d) => {
          const frac = d.count / total;
          const dash = frac * CIRC;
          const currentOffset = offset;
          offset += dash;
          if (d.count === 0) return null;
          return (
            <circle
              key={d.key}
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke={REC_COLORS[d.key] || '#ccc'}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${CIRC - dash}`}
              strokeDashoffset={-currentOffset}
              transform={`rotate(-90 ${CX} ${CY})`}
            >
              <title>{REC_LABELS[d.key]}: {d.count} ({Math.round(frac * 100)}%)</title>
            </circle>
          );
        })}
        <text x={CX} y={CY - 4} textAnchor="middle" fill="#1C0F09" fontSize={28} fontWeight={800} fontFamily="var(--font-space-grotesk)" className="tnum">
          {total}
        </text>
        <text x={CX} y={CY + 16} textAnchor="middle" fill="#1C0F09" fillOpacity={0.55} fontSize={9} fontFamily="var(--font-geist-mono)" letterSpacing="0.22em">
          TOTAL
        </text>
      </svg>

      <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center">
        {distribution.map((d) => (
          <div key={d.key} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: REC_COLORS[d.key] || '#ccc' }}
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
              {REC_LABELS[d.key] || d.key}{' '}
              <strong className="text-ink tnum">{d.count}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dimension Bars ───────────────────────────────────────────────────────────
function DimensionBars({ dimensions }: { dimensions: { key: string; avg: number }[] }) {
  if (dimensions.length === 0) return <EmptyChart label="No dimension data" />;

  return (
    <div className="flex flex-col gap-4">
      {dimensions.map((d) => {
        const pct = (d.avg / 5) * 100;
        const tone =
          d.avg >= 3.5
            ? { bar: 'bg-ink', text: 'text-ink' }
            : d.avg >= 3.0
            ? { bar: 'bg-tangerine', text: 'text-tangerine' }
            : { bar: 'bg-accent', text: 'text-accent' };
        return (
          <div key={d.key}>
            <div className="flex justify-between items-baseline mb-2">
              <span className="font-display text-[14px] text-ink tracking-[-0.01em]">
                {DIMENSION_LABELS[d.key] || d.key}
              </span>
              <span className={`font-mono text-[12px] tnum font-semibold ${tone.text}`}>
                {d.avg.toFixed(1)} / 5
              </span>
            </div>
            <div className="h-[6px] bg-ink/10 rounded-full overflow-hidden">
              <div
                className={`h-full ${tone.bar} rounded-full transition-[width] duration-700`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyChart({ label }: { label: string }) {
  return (
    <div className="py-12 px-6 text-center">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-paper-deep border border-ink/15 mb-3">
        <BarChart3 className="w-4 h-4 text-ink-soft" strokeWidth={1.8} />
      </div>
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">{label}</p>
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function Card({
  title,
  index,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  index: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-ink/15 rounded-[4px] bg-paper-deep/40 p-6 ${className || ''}`}>
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
        <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
        / {index} · {title.split(' ')[0]}
      </div>
      <h3 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-ink mb-5">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div>
      <div className="grid grid-cols-12 gap-4 mb-6">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="col-span-6 md:col-span-3 border border-ink/15 rounded-[4px] bg-paper-deep/40 p-6 h-[120px]"
          >
            <div className="h-2.5 w-1/2 bg-ink/10 rounded mb-3 animate-pulse" />
            <div className="h-8 w-2/3 bg-ink/10 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-4">
        {[1, 2].map((n) => (
          <div
            key={n}
            className="col-span-12 md:col-span-6 border border-ink/15 rounded-[4px] bg-paper-deep/40 p-6 h-[320px]"
          >
            <div className="h-3 w-1/3 bg-ink/10 rounded mb-4 animate-pulse" />
            <div className="h-[240px] bg-ink/5 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recommendation chip ──────────────────────────────────────────────────────
function RecBadge({ rec }: { rec: string }) {
  const styles: Record<string, string> = {
    strong_pass: 'bg-ink text-paper',
    pass: 'bg-tangerine text-ink',
    borderline: 'bg-sunshine text-ink',
    fail: 'bg-accent text-paper',
  };
  const cls = styles[rec] || 'bg-paper-deep text-ink-soft';
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-[0.18em] ${cls}`}
    >
      {REC_LABELS[rec] || rec}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const [allInterviews, setAllInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>('30d');

  useEffect(() => {
    (async () => {
      try {
        const data = await listInterviews(1000);
        setAllInterviews(data.filter((i) => i.status === 'assessed' && i.assessment));
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const interviews = useMemo(() => {
    const cutoff = rangeCutoff(range);
    if (!cutoff) return allInterviews;
    return allInterviews.filter((i) => new Date(i.created_at) >= cutoff);
  }, [allInterviews, range]);

  const stats = useMemo(() => {
    const total = interviews.length;
    const passed = interviews.filter((i) => {
      const r = i.assessment?.recommendation;
      return r === 'strong_pass' || r === 'pass';
    }).length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const avgScore =
      total > 0
        ? interviews.reduce((s, i) => s + (i.assessment?.overall_score ?? 0), 0) / total
        : 0;
    const durInterviews = interviews.filter((i) => i.duration_seconds && i.duration_seconds > 0);
    const avgDuration =
      durInterviews.length > 0
        ? durInterviews.reduce((s, i) => s + (i.duration_seconds ?? 0), 0) / durInterviews.length
        : 0;
    return { total, passRate, avgScore, avgDuration };
  }, [interviews]);

  const dailyCounts = useMemo(() => {
    const map: Record<string, number> = {};
    interviews.forEach((i) => {
      const k = dateKey(i.created_at);
      map[k] = (map[k] || 0) + 1;
    });

    const keys = Object.keys(map).sort();
    if (keys.length === 0) return [];
    const start = new Date(keys[0]);
    const end = new Date(keys[keys.length - 1]);
    const result: { date: string; count: number }[] = [];
    const d = new Date(start);
    while (d <= end) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      result.push({ date: k, count: map[k] || 0 });
      d.setDate(d.getDate() + 1);
    }
    return result;
  }, [interviews]);

  const recDistribution = useMemo(() => {
    const counts: Record<string, number> = { strong_pass: 0, pass: 0, borderline: 0, fail: 0 };
    interviews.forEach((i) => {
      const r = i.assessment?.recommendation;
      if (r && r in counts) counts[r]++;
    });
    return Object.entries(counts).map(([key, count]) => ({ key, count }));
  }, [interviews]);

  const dimensionAvgs = useMemo(() => {
    const dims = [
      'communication_clarity',
      'warmth_and_rapport',
      'simplification_ability',
      'patience_indicators',
      'english_fluency',
    ] as const;
    return dims.map((key) => {
      const scores = interviews
        .map((i) => i.assessment?.dimensions?.[key]?.score)
        .filter((s): s is number => typeof s === 'number');
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return { key, avg };
    });
  }, [interviews]);

  const top5 = useMemo(() => {
    return [...interviews]
      .sort((a, b) => (b.assessment?.overall_score ?? 0) - (a.assessment?.overall_score ?? 0))
      .slice(0, 5);
  }, [interviews]);

  const borderline = useMemo(() => {
    return interviews.filter((i) => i.assessment?.recommendation === 'borderline');
  }, [interviews]);

  const { topStrengths, topImprovements } = useMemo(() => {
    const strMap: Record<string, number> = {};
    const impMap: Record<string, number> = {};

    interviews.forEach((i) => {
      const a = i.assessment;
      if (!a) return;
      (a.strengths ?? []).forEach((s) => {
        const k = s.trim().toLowerCase();
        if (k) strMap[k] = (strMap[k] || 0) + 1;
      });
      (a.areas_for_improvement ?? []).forEach((s) => {
        const k = s.trim().toLowerCase();
        if (k) impMap[k] = (impMap[k] || 0) + 1;
      });
    });

    const sort = (m: Record<string, number>) =>
      Object.entries(m)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([text, count]) => ({ text, count }));

    return { topStrengths: sort(strMap), topImprovements: sort(impMap) };
  }, [interviews]);

  const scoreColor = (s: number) =>
    s >= 3.5 ? 'text-ink' : s >= 3.0 ? 'text-tangerine' : 'text-accent';

  return (
    <div>
      {/* Masthead */}
      <section className="mb-10">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Admin · 04 / 06 · Analytics
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1
            className="font-display font-extrabold tracking-[-0.03em] text-ink"
            style={{ fontSize: 'clamp(44px, 8vw, 96px)', lineHeight: 0.9 }}
          >
            Analytics.
          </h1>

          {/* Range pills */}
          <div className="flex gap-1.5 bg-paper-deep/60 border border-ink/15 rounded-full p-1">
            {(['7d', '30d', '90d', 'all'] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  range === r
                    ? 'bg-ink text-paper'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 max-w-[620px] grid grid-cols-12 gap-4">
          <div className="col-span-12 sm:col-span-3 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft pt-1">
            / Period
          </div>
          <p className="col-span-12 sm:col-span-9 font-display text-[17px] leading-[1.45] text-ink-muted tracking-[-0.01em]">
            Performance insights across all assessed interviews within the selected window.
          </p>
        </div>
        <div className="mt-6 h-[1.5px] bg-ink" />
      </section>

      {loading && <Skeleton />}

      {!loading && (
        <>
          {/* Stat strip */}
          <section className="grid grid-cols-12 gap-4 sm:gap-6 mb-8">
            {/* Total */}
            <div className="col-span-6 md:col-span-3 border border-ink/15 rounded-[4px] bg-paper-deep/40 p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2">
                / Total Screened
              </div>
              <div
                className="font-display font-extrabold text-ink tracking-[-0.02em] tnum"
                style={{ fontSize: 'clamp(32px, 4.5vw, 48px)', lineHeight: 1 }}
              >
                {stats.total}
              </div>
            </div>
            {/* Pass rate — accent */}
            <div className="col-span-6 md:col-span-3 border border-ink/15 rounded-[4px] bg-accent text-paper p-5 relative overflow-hidden">
              <span className="corner-bl" aria-hidden />
              <span className="corner-br" aria-hidden />
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-paper/70 mb-2">
                / Pass Rate
              </div>
              <div
                className="font-display font-extrabold tracking-[-0.02em] tnum text-paper"
                style={{ fontSize: 'clamp(32px, 4.5vw, 48px)', lineHeight: 1 }}
              >
                {stats.passRate}%
              </div>
              {stats.total > 0 && (
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-paper/70">
                  of {stats.total} candidates
                </div>
              )}
            </div>
            {/* Avg score */}
            <div className="col-span-6 md:col-span-3 border border-ink/15 rounded-[4px] bg-paper-deep/40 p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2">
                / Average Score
              </div>
              <div
                className="font-display font-extrabold text-ink tracking-[-0.02em] tnum"
                style={{ fontSize: 'clamp(32px, 4.5vw, 48px)', lineHeight: 1 }}
              >
                {stats.total > 0 ? stats.avgScore.toFixed(1) : '—'}
              </div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                out of 5.0
              </div>
            </div>
            {/* Avg duration */}
            <div className="col-span-6 md:col-span-3 border border-ink/15 rounded-[4px] bg-paper-deep/40 p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2">
                / Avg Duration
              </div>
              <div
                className="font-display font-extrabold text-ink tracking-[-0.02em] tnum"
                style={{ fontSize: 'clamp(32px, 4.5vw, 48px)', lineHeight: 1 }}
              >
                {stats.avgDuration > 0 ? fmtDuration(stats.avgDuration) : '—'}
              </div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                minutes
              </div>
            </div>
          </section>

          {/* Charts row */}
          <section className="grid grid-cols-12 gap-4 sm:gap-6 mb-8">
            <div className="col-span-12 md:col-span-7">
              <Card title="Interviews over time" index="01" icon={TrendingUp}>
                <AreaChart data={dailyCounts} />
              </Card>
            </div>
            <div className="col-span-12 md:col-span-5">
              <Card title="Recommendation distribution" index="02" icon={PieChart}>
                <DonutChart distribution={recDistribution} />
              </Card>
            </div>
          </section>

          {/* Dimensions */}
          <section className="mb-8">
            <Card title="Average dimension scores" index="03" icon={BarChart3}>
              <DimensionBars dimensions={dimensionAvgs} />
            </Card>
          </section>

          {/* Top & Borderline */}
          <section className="grid grid-cols-12 gap-4 sm:gap-6 mb-8">
            <div className="col-span-12 md:col-span-6">
              <Card title="Top 5 candidates" index="04" icon={Trophy}>
                {top5.length === 0 ? (
                  <EmptyChart label="No assessed candidates yet" />
                ) : (
                  <div className="flex flex-col">
                    {top5.map((interview, i) => (
                      <Link
                        key={interview.id}
                        href={`/admin/${interview.id}`}
                        className={`group flex items-center gap-3 py-3 border-b border-ink/10 last:border-b-0 transition-colors hover:bg-ink hover:text-paper -mx-2 px-2 rounded-[2px]`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] font-bold tnum shrink-0 ${
                            i < 3 ? 'bg-accent text-paper' : 'bg-paper-deep text-ink-soft group-hover:bg-paper group-hover:text-ink'
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="flex-1 font-display text-[15px] tracking-[-0.01em]">
                          {interview.candidate_name}
                        </span>
                        <span
                          className={`font-display text-[18px] font-semibold tnum tracking-[-0.01em] ${scoreColor(
                            interview.assessment?.overall_score ?? 0
                          )} group-hover:text-paper`}
                        >
                          {interview.assessment?.overall_score?.toFixed(1)}
                        </span>
                        <RecBadge rec={interview.assessment?.recommendation ?? ''} />
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div className="col-span-12 md:col-span-6">
              <Card title="Needs review" index="05" icon={AlertTriangle}>
                {borderline.length === 0 ? (
                  <div className="py-8 px-6 text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-paper-deep border border-ink/15 mb-3">
                      <Sparkles className="w-4 h-4 text-ink-soft" strokeWidth={1.8} />
                    </div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
                      No borderline candidates in this period
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {borderline.map((interview) => (
                      <Link
                        key={interview.id}
                        href={`/admin/${interview.id}`}
                        className="group flex items-center gap-3 py-3 border-b border-ink/10 last:border-b-0 transition-colors hover:bg-ink hover:text-paper -mx-2 px-2 rounded-[2px]"
                      >
                        <span className="flex-1 font-display text-[15px] tracking-[-0.01em]">
                          {interview.candidate_name}
                        </span>
                        <span className="font-display text-[17px] font-semibold tnum tracking-[-0.01em] text-sunshine group-hover:text-paper">
                          {interview.assessment?.overall_score?.toFixed(1)}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent group-hover:text-paper">
                          Review →
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </section>

          {/* Strengths & Improvements */}
          <section className="grid grid-cols-12 gap-4 sm:gap-6 mb-8">
            <div className="col-span-12 md:col-span-6">
              <Card title="Common strengths" index="06" icon={Sparkles}>
                {topStrengths.length === 0 ? (
                  <EmptyChart label="No data yet" />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {topStrengths.map((s) => (
                      <span
                        key={s.text}
                        className="inline-flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-ink text-paper font-display text-[12px] tracking-[-0.005em]"
                      >
                        {s.text}
                        <span className="bg-paper text-ink rounded-full px-2 py-0.5 font-mono text-[10px] tnum font-bold">
                          {s.count}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div className="col-span-12 md:col-span-6">
              <Card title="Common areas for improvement" index="07" icon={AlertTriangle}>
                {topImprovements.length === 0 ? (
                  <EmptyChart label="No data yet" />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {topImprovements.map((s) => (
                      <span
                        key={s.text}
                        className="inline-flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-sunshine text-ink font-display text-[12px] tracking-[-0.005em]"
                      >
                        {s.text}
                        <span className="bg-ink text-paper rounded-full px-2 py-0.5 font-mono text-[10px] tnum font-bold">
                          {s.count}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
