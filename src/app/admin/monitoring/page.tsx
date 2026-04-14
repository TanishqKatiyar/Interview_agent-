'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  Activity,
  PieChart,
  Zap,
  ArrowRight,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  interview_id: string | null;
  data: Record<string, unknown> | null;
}

type TimeRange = 1 | 24 | 168;

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function latencyClasses(ms: number): string {
  if (ms < 500) return 'text-accent';
  if (ms <= 1000) return 'text-sunshine';
  return 'text-tangerine';
}

// ─── SVG Donut Chart ────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  groq: '#D63426',
  gemini: '#6B9BC9',
  openrouter: '#4A3B5A',
  unknown: '#A3957E',
};

function DonutChart({ data }: { data: { name: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
        No data yet
      </div>
    );
  }

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 65;
  const strokeWidth = 22;

  let cumulativeAngle = -90;

  const arcs = data.map((d) => {
    const pct = d.count / total;
    const angle = pct * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;

    return {
      ...d,
      pct,
      path: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      color: PROVIDER_COLORS[d.name] || PROVIDER_COLORS.unknown,
    };
  });

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--rule)" strokeWidth={strokeWidth} opacity={0.4} />
        {arcs.map((arc, i) => (
          <path
            key={i}
            d={arc.path}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
        ))}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill="var(--ink)"
          fontSize={28}
          fontWeight={800}
          fontFamily="var(--font-display), sans-serif"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          fill="var(--ink-soft)"
          fontSize={10}
          fontFamily="var(--font-geist-mono), monospace"
          letterSpacing="0.22em"
        >
          REQUESTS
        </text>
      </svg>
      <div className="flex flex-col gap-2.5">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: arc.color }} />
            <span className="font-display text-[14px] text-ink capitalize">{arc.name}</span>
            <span className="font-mono text-[11px] tnum tracking-[0.18em] text-ink-soft">
              {arc.count} · {Math.round(arc.pct * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SVG Area Chart ─────────────────────────────────────────────────────────

function AreaChart({ data, label }: { data: { label: string; count: number }[]; label: string }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
        No errors — all clear
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const w = 440;
  const h = 160;
  const padX = 40;
  const padY = 20;
  const drawW = w - padX * 2;
  const drawH = h - padY * 2;

  const points = data.map((d, i) => {
    const x = padX + (i / Math.max(data.length - 1, 1)) * drawW;
    const y = padY + drawH - (d.count / maxCount) * drawH;
    return { x, y, ...d };
  });

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaStr =
    `${padX},${padY + drawH} ` + polylineStr + ` ${points[points.length - 1].x},${padY + drawH}`;

  return (
    <svg width="100%" height={h + 30} viewBox={`0 0 ${w} ${h + 30}`} preserveAspectRatio="xMidYMid meet">
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = padY + drawH - frac * drawH;
        return (
          <g key={frac}>
            <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="var(--rule)" strokeWidth={1} opacity={0.6} />
            <text x={padX - 6} y={y + 4} textAnchor="end" fill="var(--ink-soft)" fontSize={10} fontFamily="var(--font-geist-mono), monospace">
              {Math.round(frac * maxCount)}
            </text>
          </g>
        );
      })}

      <polygon points={areaStr} fill="rgba(214, 52, 38, 0.12)" />

      <polyline points={polylineStr} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />

      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--accent)" />
      ))}

      {[0, Math.floor(data.length / 2), data.length - 1].map((idx) => {
        if (idx >= data.length) return null;
        const p = points[idx];
        return (
          <text
            key={idx}
            x={p.x}
            y={h + 16}
            textAnchor="middle"
            fill="var(--ink-soft)"
            fontSize={10}
            fontFamily="var(--font-geist-mono), monospace"
            letterSpacing="0.18em"
          >
            {data[idx].label}
          </text>
        );
      })}

      <text
        x={w / 2}
        y={h + 28}
        textAnchor="middle"
        fill="var(--ink-soft)"
        fontSize={10}
        fontFamily="var(--font-geist-mono), monospace"
        letterSpacing="0.22em"
      >
        {label.toUpperCase()}
      </text>
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function MonitoringPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>(24);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async (hours: number) => {
    try {
      const res = await fetch(`/api/admin/logs?hours=${hours}`);
      if (res.status === 401) {
        if (typeof window !== 'undefined') window.location.reload();
        return;
      }
      const { logs: data } = await res.json();
      setLogs(data || []);
    } catch (e) {
      console.error('[MONITORING] Fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLogs(timeRange);

    if (refreshRef.current) clearInterval(refreshRef.current);
    refreshRef.current = setInterval(() => fetchLogs(timeRange), 30_000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [timeRange, fetchLogs]);

  // ── Derived metrics ──
  const totalInterviews = logs.filter(
    (l) => l.category === 'interview' && l.message === 'Interview started',
  ).length;
  const completedInterviews = logs.filter(
    (l) => l.category === 'interview' && l.message === 'Interview completed',
  ).length;
  const errorCount = logs.filter((l) => l.level === 'error').length;

  const llmLatencyLogs = logs.filter(
    (l) => l.category === 'llm' && l.message === 'LLM response received' && (l.data?.latency_ms as number | undefined),
  );
  const avgLlmLatency =
    llmLatencyLogs.length > 0
      ? Math.round(
          llmLatencyLogs.reduce((s, l) => s + ((l.data?.latency_ms as number) || 0), 0) /
            llmLatencyLogs.length,
        )
      : 0;

  const ttsLatencyLogs = logs.filter(
    (l) =>
      l.category === 'tts' &&
      l.message === 'TTS generated' &&
      l.data?.cache_hit === false &&
      (l.data?.latency_ms as number | undefined),
  );
  const avgTtsLatency =
    ttsLatencyLogs.length > 0
      ? Math.round(
          ttsLatencyLogs.reduce((s, l) => s + ((l.data?.latency_ms as number) || 0), 0) /
            ttsLatencyLogs.length,
        )
      : 0;

  const providerUsage: Record<string, number> = {};
  logs
    .filter((l) => l.category === 'llm' && l.message === 'LLM response received' && l.data?.provider)
    .forEach((l) => {
      const p = l.data!.provider as string;
      providerUsage[p] = (providerUsage[p] || 0) + 1;
    });
  const donutData = Object.entries(providerUsage).map(([name, count]) => ({ name, count }));

  const errorLogs = logs.filter((l) => l.level === 'error');
  const errorsOverTime: { label: string; count: number }[] = (() => {
    if (errorLogs.length === 0) return [];
    const bucketMs = timeRange <= 1 ? 5 * 60 * 1000 : timeRange <= 24 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const now = Date.now();
    const start = now - timeRange * 60 * 60 * 1000;
    const buckets: Map<number, number> = new Map();

    for (let t = start; t <= now; t += bucketMs) {
      buckets.set(t, 0);
    }
    errorLogs.forEach((l) => {
      const ts = new Date(l.timestamp).getTime();
      const bucketKey = start + Math.floor((ts - start) / bucketMs) * bucketMs;
      if (buckets.has(bucketKey)) {
        buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + 1);
      }
    });

    return Array.from(buckets.entries()).map(([ts, count]) => {
      const d = new Date(ts);
      const label =
        timeRange <= 24
          ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { label, count };
    });
  })();

  const recentErrors = logs.filter((l) => l.level === 'error').slice(0, 20);
  const recoveryEvents = logs.filter((l) => l.category === 'recovery').slice(0, 20);

  const lastHourLogs = logs.filter(
    (l) => Date.now() - new Date(l.timestamp).getTime() < 60 * 60 * 1000,
  );
  const lastHourErrors = lastHourLogs.filter((l) => l.level === 'error').length;
  const lastHourLLMFailures = lastHourLogs.filter(
    (l) => l.category === 'llm' && l.level === 'error',
  ).length;
  const completionRate = totalInterviews > 0 ? (completedInterviews / totalInterviews) * 100 : 100;

  const alerts: { text: string }[] = [];
  if (lastHourErrors > 10) alerts.push({ text: 'Elevated error rate in the last hour' });
  if (lastHourLLMFailures > 2) alerts.push({ text: 'LLM providers experiencing issues — multiple failures in the last hour' });
  if (totalInterviews > 3 && completionRate < 70)
    alerts.push({ text: 'Low interview completion rate — investigate recent errors' });

  const rangeLabel = (h: TimeRange) =>
    h === 1 ? 'Last hour' : h === 24 ? 'Last 24h' : 'Last 7d';

  return (
    <div>
      {/* Masthead */}
      <section className="mb-8 flex items-start justify-between flex-wrap gap-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Admin · 05 / 06 · Monitoring
          </div>
          <h1
            className="font-display font-extrabold tracking-[-0.03em] text-ink"
            style={{ fontSize: 'clamp(44px, 8vw, 96px)', lineHeight: 0.9 }}
          >
            Monitoring.
          </h1>
          <p className="mt-3 font-display text-[15px] text-ink-muted tracking-[-0.01em]">
            Real-time health & performance of the screener.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {([1, 24, 168] as TimeRange[]).map((h) => (
            <button
              key={h}
              onClick={() => setTimeRange(h)}
              className={
                'px-4 py-2 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] transition ' +
                (timeRange === h
                  ? 'bg-accent text-paper'
                  : 'border border-ink/20 text-ink-soft hover:bg-ink hover:text-paper hover:border-ink')
              }
            >
              {rangeLabel(h)}
            </button>
          ))}
        </div>
      </section>

      <div className="mb-8 h-[1.5px] bg-ink" />

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3 mb-8">
          {alerts.map((a, i) => (
            <div
              key={i}
              className="border-l-[3px] border-tangerine bg-tangerine/10 px-4 py-3 rounded-[4px] flex items-center gap-3"
            >
              <AlertTriangle className="w-4 h-4 text-tangerine shrink-0" strokeWidth={2} />
              <span className="font-display text-[15px] text-ink">{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-[400px] font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
          Loading logs…
        </div>
      ) : (
        <>
          {/* Stat strip */}
          <section className="grid grid-cols-12 gap-4 mb-8">
            {[
              {
                code: '01',
                label: 'Interviews',
                value: totalInterviews,
                sub: `${completedInterviews} completed`,
                span: 'col-span-12 md:col-span-6 lg:col-span-3',
                tone: 'ink' as const,
              },
              {
                code: '02',
                label: 'Errors',
                value: errorCount,
                sub: errorCount === 0 ? 'All clear' : `${lastHourErrors} in last hour`,
                span: 'col-span-12 md:col-span-6 lg:col-span-3',
                tone: errorCount > 0 ? ('warn' as const) : ('paper' as const),
              },
              {
                code: '03',
                label: 'LLM latency',
                value: avgLlmLatency ? `${avgLlmLatency}ms` : '—',
                sub: `${llmLatencyLogs.length} req`,
                span: 'col-span-6 lg:col-span-3',
                tone: 'paper' as const,
                valueClass: avgLlmLatency ? latencyClasses(avgLlmLatency) : 'text-ink-soft',
              },
              {
                code: '04',
                label: 'TTS latency',
                value: avgTtsLatency ? `${avgTtsLatency}ms` : '—',
                sub: `${ttsLatencyLogs.length} misses`,
                span: 'col-span-6 lg:col-span-3',
                tone: 'paper' as const,
                valueClass: avgTtsLatency ? latencyClasses(avgTtsLatency) : 'text-ink-soft',
              },
            ].map((s) => {
              const base = 'relative border rounded-[4px] p-5 ';
              const toneClass =
                s.tone === 'ink'
                  ? 'bg-ink text-paper border-ink'
                  : s.tone === 'warn'
                    ? 'bg-tangerine/10 border-tangerine/40 text-ink'
                    : 'bg-paper-deep/40 border-ink/15 text-ink';
              const labelClass = s.tone === 'ink' ? 'text-paper/60' : 'text-ink-soft';
              return (
                <div key={s.code} className={base + toneClass + ' ' + s.span}>
                  <div className={'flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] mb-3 ' + labelClass}>
                    <span>/ {s.code}</span>
                    <span>{s.label}</span>
                  </div>
                  <div
                    className={
                      'font-display font-extrabold tnum tracking-[-0.02em] ' +
                      (s.valueClass || '')
                    }
                    style={{ fontSize: 'clamp(32px, 4vw, 48px)', lineHeight: 1 }}
                  >
                    {s.value}
                  </div>
                  <div className={'mt-2 font-mono text-[10px] uppercase tracking-[0.22em] ' + labelClass}>
                    {s.sub}
                  </div>
                </div>
              );
            })}
          </section>

          {/* Charts */}
          <section className="grid grid-cols-12 gap-4 mb-8">
            <div className="col-span-12 md:col-span-6 border border-ink/15 rounded-[4px] bg-paper-deep/40 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
                    <PieChart className="w-3.5 h-3.5" strokeWidth={1.8} />
                    / Providers
                  </div>
                  <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
                    Provider usage
                  </h3>
                </div>
              </div>
              <DonutChart data={donutData} />
            </div>

            <div className="col-span-12 md:col-span-6 border border-ink/15 rounded-[4px] bg-paper-deep/40 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
                    <Activity className="w-3.5 h-3.5" strokeWidth={1.8} />
                    / Errors
                  </div>
                  <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
                    Errors over time
                  </h3>
                </div>
              </div>
              <AreaChart
                data={errorsOverTime}
                label={timeRange <= 1 ? 'Every 5 min' : timeRange <= 24 ? 'Hourly' : 'Daily'}
              />
            </div>
          </section>

          {/* Recent Errors */}
          <section className="border border-ink/15 rounded-[4px] bg-paper overflow-hidden mb-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink/15 bg-paper-deep/40">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-0.5">
                  / 05 · Log
                </div>
                <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
                  Recent errors
                </h3>
              </div>
              <button
                onClick={() => fetchLogs(timeRange)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-ink/20 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft hover:bg-ink hover:text-paper hover:border-ink transition"
              >
                <RefreshCw className="w-3 h-3" strokeWidth={2} />
                Refresh
              </button>
            </div>

            {recentErrors.length === 0 ? (
              <div className="px-6 py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                No errors in this window
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-ink/15 bg-paper-deep/40">
                      {['/ Time', '/ Category', '/ Message', '/ Interview'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentErrors.map((log, idx) => (
                      <Fragment key={log.id}>
                        <tr
                          onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                          className={
                            'cursor-pointer hover:bg-paper-deep/40 transition ' +
                            (idx > 0 ? 'border-t border-ink/10' : '')
                          }
                        >
                          <td className="px-4 py-3 font-mono text-[11px] tnum uppercase tracking-[0.18em] text-ink-soft whitespace-nowrap">
                            {relativeTime(log.timestamp)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-[3px] rounded-full bg-tangerine/15 text-tangerine font-mono text-[9px] uppercase tracking-[0.18em]">
                              {log.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-display text-[14px] text-ink max-w-md truncate">
                            {log.message}
                          </td>
                          <td className="px-4 py-3">
                            {log.interview_id ? (
                              <a
                                href={`/admin/${log.interview_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:text-accent-deep transition"
                              >
                                View
                                <ArrowRight className="w-3 h-3" strokeWidth={2} />
                              </a>
                            ) : (
                              <span className="font-mono text-[10px] text-ink-soft">—</span>
                            )}
                          </td>
                        </tr>
                        {expandedRow === log.id && log.data && (
                          <tr className="bg-paper-deep/20">
                            <td colSpan={4} className="px-4 py-4">
                              <pre className="font-mono text-[11px] text-ink-muted whitespace-pre-wrap break-all leading-[1.5]">
                                {JSON.stringify(log.data, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recovery events */}
          <section className="border border-ink/15 rounded-[4px] bg-paper overflow-hidden">
            <div className="px-5 py-4 border-b border-ink/15 bg-paper-deep/40">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-0.5">
                / 06 · Recovery
              </div>
              <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
                Recovery events{' '}
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft font-normal">
                  · fallbacks, emergency responses
                </span>
              </h3>
            </div>

            {recoveryEvents.length === 0 ? (
              <div className="px-6 py-12 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                <Zap className="w-4 h-4 inline-block mr-2" strokeWidth={2} />
                Stable operation
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-ink/15 bg-paper-deep/40">
                      {['/ Time', '/ Message', '/ Interview', '/ Context'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recoveryEvents.map((log, idx) => (
                      <tr
                        key={log.id}
                        className={idx > 0 ? 'border-t border-ink/10' : ''}
                      >
                        <td className="px-4 py-3 font-mono text-[11px] tnum uppercase tracking-[0.18em] text-ink-soft whitespace-nowrap">
                          {relativeTime(log.timestamp)}
                        </td>
                        <td className="px-4 py-3 font-display text-[14px] text-sunshine font-medium">
                          {log.message}
                        </td>
                        <td className="px-4 py-3">
                          {log.interview_id ? (
                            <a
                              href={`/admin/${log.interview_id}`}
                              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:text-accent-deep transition"
                            >
                              View
                              <ArrowRight className="w-3 h-3" strokeWidth={2} />
                            </a>
                          ) : (
                            <span className="font-mono text-[10px] text-ink-soft">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-ink-muted max-w-[250px] truncate">
                          {log.data
                            ? Object.entries(log.data)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(', ')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
