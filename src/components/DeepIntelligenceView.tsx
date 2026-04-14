'use client';

import { useState } from 'react';
import type { SpeechAnalytics, IntegrityReport, InterviewQuality } from '@/lib/types';
import {
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  MessageCircleQuestion,
  Lightbulb,
  Target,
  ListOrdered,
  Plus,
  Minus as MinusIcon,
} from 'lucide-react';

interface Props {
  speech: SpeechAnalytics;
  integrity: IntegrityReport;
  quality: InterviewQuality;
}

export default function DeepIntelligenceView({ speech, integrity, quality }: Props) {
  const [expandedFlag, setExpandedFlag] = useState<number | null>(null);

  const hasIntegrityIssues = integrity.flags.length > 0;

  const signalCls =
    quality.signalStrength === 'strong'
      ? 'bg-ink text-paper'
      : quality.signalStrength === 'weak'
      ? 'bg-accent text-paper'
      : 'bg-sunshine text-ink';

  const flagTone = (sev: string) => {
    if (sev === 'high') return { dot: 'bg-accent', head: 'bg-accent/10' };
    if (sev === 'medium') return { dot: 'bg-tangerine', head: 'bg-tangerine/10' };
    return { dot: 'bg-ink/40', head: 'bg-paper-deep/60' };
  };

  return (
    <div className="flex flex-col gap-6 mt-6 pt-6 border-t border-ink/10">
      {/* ── INTERVIEW QUALITY ── */}
      <div className="border border-ink/15 rounded-[4px] bg-paper-deep/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-ink/10 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
            <Activity className="w-3.5 h-3.5" strokeWidth={1.8} />
            / 01 · Meta
          </div>
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">
            Interview quality
          </h2>
          <span
            className={`ml-auto inline-block px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] ${signalCls}`}
          >
            Signal · {quality.signalStrength}
          </span>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
                / Questions asked
              </div>
              <div className="font-display text-[20px] font-semibold text-ink tnum tracking-[-0.01em]">
                {quality.factors.questionsAsked}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
                / Follow-ups
              </div>
              <div className="font-display text-[20px] font-semibold text-ink tnum tracking-[-0.01em]">
                {quality.factors.followUpsAsked}
                <span className="ml-2 font-mono text-[11px] text-ink-soft tracking-[0.18em]">
                  {quality.factors.depthScore}% depth
                </span>
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
                / Candidate speak time
              </div>
              <div className="font-display text-[20px] font-semibold text-ink tnum tracking-[-0.01em]">
                {(quality.factors.balanceRatio * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {quality.recommendations.length > 0 && (
            <div className="relative border border-ink/15 rounded-[4px] bg-accent text-paper p-4 overflow-hidden">
              <span className="corner-bl" aria-hidden />
              <span className="corner-br" aria-hidden />
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-paper/80 mb-2">
                / Next time
              </p>
              <ul className="flex flex-col gap-1.5">
                {quality.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="font-display text-[14px] leading-[1.5] tracking-[-0.005em] text-paper flex gap-2"
                  >
                    <span>—</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── SPEECH ANALYTICS ── */}
      <div className="border border-ink/15 rounded-[4px] bg-paper-deep/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-ink/10 flex items-center gap-2">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
            <MessageCircleQuestion className="w-3.5 h-3.5" strokeWidth={1.8} />
            / 02 · Speech
          </div>
          <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">
            Speech pattern analytics
          </h2>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4 mb-6">
            <div className="border border-ink/10 rounded-[4px] bg-paper/60 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
                / Vocab diversity
              </div>
              <div className="font-display text-[22px] font-semibold text-ink tnum tracking-[-0.01em]">
                {speech.vocabularyDiversity}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mt-2">
                {speech.vocabularyDiversity > 0.65
                  ? 'High · varied'
                  : speech.vocabularyDiversity < 0.4
                  ? 'Low · repetitive'
                  : 'Normal'}
              </div>
            </div>
            <div className="border border-ink/10 rounded-[4px] bg-paper/60 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
                / Hedging · filler
              </div>
              <div className="font-display text-[22px] font-semibold text-ink tnum tracking-[-0.01em]">
                {speech.hedgingFrequency}
                <span className="ml-1 font-mono text-[11px] text-ink-soft tracking-[0.18em]">
                  /100w
                </span>
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mt-2">
                {speech.assertivenessScore > 0.8
                  ? 'Highly assertive'
                  : speech.assertivenessScore < 0.4
                  ? 'Hesitant'
                  : 'Normal'}
              </div>
            </div>
            <div className="border border-ink/10 rounded-[4px] bg-paper/60 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
                / Engagement trend
              </div>
              <div className="flex items-center gap-2 mt-1">
                {speech.elaborationTrend === 'increasing' ? (
                  <TrendingUp className="w-5 h-5 text-ink" strokeWidth={2} />
                ) : speech.elaborationTrend === 'decreasing' ? (
                  <TrendingDown className="w-5 h-5 text-accent" strokeWidth={2} />
                ) : (
                  <Minus className="w-5 h-5 text-ink-soft" strokeWidth={2} />
                )}
                <span className="font-display text-[16px] font-semibold text-ink tracking-[-0.01em] capitalize">
                  {speech.elaborationTrend}
                </span>
              </div>
            </div>
          </div>

          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-3">
            / Teaching indicators
          </p>
          <div className="flex gap-2 flex-wrap">
            {[
              { icon: Lightbulb, label: 'Analogies', count: speech.analogyCount },
              { icon: Target, label: 'Concrete examples', count: speech.concreteExampleCount },
              { icon: ListOrdered, label: 'Step-by-step', count: speech.stepByStepCount },
              { icon: MessageCircleQuestion, label: 'Checking questions', count: speech.questionUsage },
            ].map(({ icon: Icon, label, count }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-ink text-paper font-display text-[12px] tracking-[-0.005em]"
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                {label}
                <span className="bg-paper text-ink rounded-full px-2 py-0.5 font-mono text-[10px] tnum font-bold">
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── INTEGRITY REPORT ── */}
      <div className="border border-ink/15 rounded-[4px] bg-paper-deep/40 overflow-hidden">
        <div
          className={`px-5 py-4 border-b border-ink/10 flex items-center gap-2 ${
            hasIntegrityIssues ? 'bg-accent/8' : ''
          }`}
        >
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
            {hasIntegrityIssues ? (
              <ShieldAlert className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-ink" strokeWidth={2} />
            )}
            / 03 · Integrity
          </div>
          <h2
            className={`font-display text-[16px] font-semibold tracking-[-0.01em] ${
              hasIntegrityIssues ? 'text-accent' : 'text-ink'
            }`}
          >
            Anti-gaming &amp; integrity
          </h2>
        </div>

        <div className="p-5">
          {!hasIntegrityIssues ? (
            <p className="font-display text-[14px] leading-[1.55] tracking-[-0.005em] text-ink">
              No significant integrity concerns or behavioral anomalies detected.
            </p>
          ) : (
            <div>
              <p className="font-display text-[14px] leading-[1.55] tracking-[-0.005em] text-ink-muted mb-5">
                The system flagged {integrity.flags.length} pattern{integrity.flags.length !== 1 ? 's' : ''} worth noting. These are heuristic observations, not definitive accusations.
              </p>

              <div className="flex flex-col gap-3">
                {integrity.flags.map((flag, idx) => {
                  const tone = flagTone(flag.severity);
                  const isOpen = expandedFlag === idx;
                  return (
                    <div
                      key={idx}
                      className="border border-ink/15 rounded-[4px] overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedFlag(isOpen ? null : idx)}
                        className={`w-full px-4 py-3 flex items-center justify-between ${tone.head} hover:bg-ink/5 transition-colors`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
                          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink font-semibold">
                            {flag.type.replace(/_/g, ' ')}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
                            · {flag.severity}
                          </span>
                        </div>
                        {isOpen ? (
                          <MinusIcon className="w-4 h-4 text-ink-soft" strokeWidth={2} />
                        ) : (
                          <Plus className="w-4 h-4 text-ink-soft" strokeWidth={2} />
                        )}
                      </button>

                      {isOpen && (
                        <div className="p-4 bg-paper/60 border-t border-ink/10">
                          <p className="font-display text-[14px] leading-[1.55] tracking-[-0.005em] text-ink mb-3">
                            {flag.explanation}
                          </p>
                          <div className="border border-ink/10 rounded-[4px] bg-paper-deep/60 p-3 font-mono text-[12px] text-ink-muted leading-[1.5]">
                            <span className="text-ink-soft uppercase tracking-[0.22em] text-[10px] mr-2">
                              / Evidence
                            </span>
                            {flag.evidence}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
