import { listInterviews } from '@/lib/supabase';
import { generateStrategicInsight } from '@/lib/gemini';
import { BrainCircuit, Clock, Activity, PieChart } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  const allInterviews = await listInterviews(500);
  const valid = allInterviews.filter((i) => i.assessment && (i.status === 'completed' || i.status === 'assessed'));

  if (valid.length === 0) {
    return (
      <div className="max-w-[900px]">
        <section className="mb-10">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Admin · 03 / 06 · Insights
          </div>
          <h1
            className="font-display font-extrabold tracking-[-0.03em] text-ink"
            style={{ fontSize: 'clamp(44px, 8vw, 96px)', lineHeight: 0.9 }}
          >
            Insights.
          </h1>
          <div className="mt-6 h-[1.5px] bg-ink" />
        </section>

        <section className="border border-ink/15 rounded-[4px] bg-paper-deep/40 px-6 py-16 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent mb-3">
            / Not enough data
          </div>
          <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink mb-2">
            Complete at least one assessment
          </h2>
          <p className="font-display text-[15px] text-ink-muted">
            Aggregate insights unlock once you&apos;ve scored one or more candidates.
          </p>
        </section>
      </div>
    );
  }

  // ─── A. Dimension effectiveness ───
  const dimensions = [
    'communication_clarity',
    'warmth_and_rapport',
    'simplification_ability',
    'patience_indicators',
    'english_fluency',
  ] as const;

  const dimStats = dimensions
    .map((d) => {
      const scores = valid.map((i) => i.assessment!.dimensions[d]?.score || 0).filter((s) => s > 0);
      const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
      const variance = scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / (scores.length || 1);
      return { name: d, avg: avg.toFixed(2), var: variance.toFixed(2) };
    })
    .sort((a, b) => parseFloat(b.var) - parseFloat(a.var));

  const highestVarianceDim = dimStats[0];

  // ─── B. Persona distribution ───
  const personas: Record<string, number> = {};
  valid.forEach((i) => {
    const p = i.assessment?.teaching_persona?.type;
    if (p) personas[p] = (personas[p] || 0) + 1;
  });
  const topPersona = Object.entries(personas).sort((a, b) => b[1] - a[1])[0] || ['Unknown', 0];

  // ─── D. Time of day ───
  const hours: Record<number, { count: number; totalScore: number }> = {};
  valid.forEach((i) => {
    const hr = new Date(i.created_at).getHours();
    if (!hours[hr]) hours[hr] = { count: 0, totalScore: 0 };
    hours[hr].count++;
    hours[hr].totalScore += i.assessment!.overall_score;
  });

  let bestHour = -1;
  let bestHourAvg = 0;
  Object.entries(hours).forEach(([h, data]) => {
    const avg = data.totalScore / data.count;
    if (avg > bestHourAvg && data.count > 1) {
      bestHourAvg = avg;
      bestHour = parseInt(h);
    }
  });

  // ─── F. LLM synthesis ───
  const statsString = `
    Total Interviews: ${valid.length}
    Most Differentiating Skill: ${highestVarianceDim.name} (Variance: ${highestVarianceDim.var})
    Most Common Persona: ${topPersona[0]} (${topPersona[1]} candidates)
    Best Performance Hour: ${bestHour === -1 ? 'Not enough data' : `${bestHour}:00 (Avg ${bestHourAvg.toFixed(1)})`}
  `;

  const llmInsight = await generateStrategicInsight(statsString);

  return (
    <div>
      {/* Masthead */}
      <section className="mb-10">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Admin · 03 / 06 · Insights
        </div>
        <h1
          className="font-display font-extrabold tracking-[-0.03em] text-ink"
          style={{ fontSize: 'clamp(44px, 8vw, 96px)', lineHeight: 0.9 }}
        >
          Insights.
        </h1>
        <div className="mt-4 max-w-[620px] grid grid-cols-12 gap-4">
          <div className="col-span-12 sm:col-span-3 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft pt-1">
            / Cohort
          </div>
          <p className="col-span-12 sm:col-span-9 font-display text-[17px] leading-[1.45] text-ink-muted tracking-[-0.01em]">
            Aggregate analytics across {valid.length} assessed candidate{valid.length !== 1 ? 's' : ''}.
          </p>
        </div>
        <div className="mt-6 h-[1.5px] bg-ink" />
      </section>

      {/* LLM strategic insight — hero card */}
      <section className="relative border border-ink/15 rounded-[4px] bg-accent text-paper p-6 sm:p-8 mb-8 overflow-hidden">
        <span className="corner-bl" aria-hidden />
        <span className="corner-br" aria-hidden />
        <div className="flex items-center gap-2 mb-3 font-mono text-[10px] uppercase tracking-[0.28em] text-paper/70">
          <BrainCircuit className="w-3.5 h-3.5" strokeWidth={2} />
          / Strategic recommendation
        </div>
        <p className="font-display text-[19px] sm:text-[22px] leading-[1.45] tracking-[-0.01em] text-paper">
          {llmInsight}
        </p>
      </section>

      {/* Stat bento */}
      <section className="grid grid-cols-12 gap-4 sm:gap-6">
        {/* Dimension effectiveness */}
        <div className="col-span-12 md:col-span-6 border border-ink/15 rounded-[4px] p-6 bg-paper-deep/40">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
            <Activity className="w-3.5 h-3.5" strokeWidth={1.8} />
            / 01 · Differentiation
          </div>
          <h3 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-ink mb-3">
            Dimension effectiveness
          </h3>
          <p className="font-display text-[14px] text-ink-muted leading-[1.5] mb-5">
            Highest variance = strongest candidate differentiator. Consider weighting these heavier.
          </p>
          <div className="space-y-3">
            {dimStats.map((d, i) => (
              <div
                key={d.name}
                className="flex items-center justify-between py-2 border-b border-ink/10 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] tnum text-ink-soft w-6">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-display text-[14px] text-ink capitalize">
                    {d.name.replace(/_/g, ' ')}
                  </span>
                </div>
                <span
                  className={
                    'font-mono text-[11px] tnum uppercase tracking-[0.18em] ' +
                    (i === 0 ? 'text-accent font-semibold' : 'text-ink-soft')
                  }
                >
                  Var · {d.var}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Persona distribution */}
        <div className="col-span-12 md:col-span-6 border border-ink/15 rounded-[4px] p-6 bg-paper-deep/40">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
            <PieChart className="w-3.5 h-3.5" strokeWidth={1.8} />
            / 02 · Personas
          </div>
          <h3 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-ink mb-3">
            Persona distribution
          </h3>
          <p className="font-display text-[14px] text-ink-muted leading-[1.5] mb-5">
            The breakdown of archetypes currently entering your funnel.
          </p>
          <div className="space-y-3">
            {Object.entries(personas)
              .sort((a, b) => b[1] - a[1])
              .map(([p, cnt]) => {
                const pct = Math.round((cnt / valid.length) * 100);
                return (
                  <div key={p}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-display text-[14px] text-ink capitalize">
                        {p.replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono text-[11px] tnum tracking-[0.18em] text-ink">
                        {pct}%
                      </span>
                    </div>
                    <div className="h-[3px] bg-ink/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Time of day */}
        <div className="col-span-12 border border-ink/15 rounded-[4px] p-6 bg-paper-deep/40">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
            <Clock className="w-3.5 h-3.5" strokeWidth={1.8} />
            / 03 · Temporal
          </div>
          <h3 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-ink mb-3">
            Time-of-day analytics
          </h3>
          <p className="font-display text-[14px] text-ink-muted leading-[1.5] mb-5">
            Average performance by the hour the candidate took the screening.
          </p>
          {bestHour !== -1 ? (
            <div className="border-l-[3px] border-accent bg-accent/5 pl-5 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent mb-2">
                / Peak performance window
              </div>
              <div
                className="font-display font-extrabold text-ink tracking-[-0.02em] tnum"
                style={{ fontSize: 'clamp(36px, 5vw, 64px)', lineHeight: 1 }}
              >
                {String(bestHour).padStart(2, '0')}:00 — {String(bestHour + 1).padStart(2, '0')}:00
              </div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                Averaging {bestHourAvg.toFixed(2)} / 5.0 overall
              </div>
            </div>
          ) : (
            <div className="border border-ink/10 rounded-[4px] px-5 py-4 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
              Needs 2+ assessments in the same hour to compute
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
