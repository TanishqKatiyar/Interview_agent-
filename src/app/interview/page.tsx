'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════════
// /interview — public entry point
// Candidate types name + email, we spin up an interview row, then redirect
// into /interview/[token] where the live room picks up. Tokyo + wodniack DNA.
// ═════════════════════════════════════════════════════════════════════════════

const TAXONOMY = '#TSR-2026';

const META = [
  { label: 'Duration',     value: '~8 min' },
  { label: 'Format',       value: 'Voice only' },
  { label: 'Interviewer',  value: 'Nisha, AI' },
  { label: 'Recorded',     value: 'Yes' },
  { label: 'Questions',    value: '4 core' },
  { label: 'Scoring',      value: 'Automated' },
];

export default function InterviewStartPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionNo, setSessionNo] = useState<number | null>(null);

  useEffect(() => {
    setSessionNo(Math.floor(Math.random() * 999) + 100);
  }, []);

  const submit = async () => {
    setError('');
    const n = name.trim();
    const e = email.trim();
    if (!n) { setError('Please enter your full name'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setError('Please enter a valid email'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/interviews/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_name: n, candidate_email: e, send_email: false }),
      });
      const data = await res.json();
      if (!res.ok || !data.interview_token) {
        throw new Error(data.error || 'Failed to create your interview');
      }
      router.push(`/interview/${data.interview_token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col overflow-hidden">
      {/* ── Top editorial strip ─────────────────────────────────────────── */}
      <header className="border-b border-ink/15">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-10 py-3.5 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.28em] text-ink-soft">
          <Link href="/" className="flex items-center gap-3 text-ink hover:text-accent transition">
            <span className="font-display font-semibold normal-case text-[15px] tracking-normal">
              Cue<span className="text-accent">math</span>
            </span>
            <span>/ Screener</span>
          </Link>
          <div className="hidden sm:block tnum">{TAXONOMY}/ENTRY · Session №{sessionNo ?? '—'}</div>
          <Link href="/" className="hover:text-ink transition">← Home</Link>
        </div>
      </header>

      {/* ── Main split layout ───────────────────────────────────────────── */}
      <main className="relative flex-1 grid grid-cols-12">
        {/* Left: editorial masthead */}
        <section className="relative col-span-12 md:col-span-7 lg:col-span-8 px-5 sm:px-10 py-14 md:py-20 flex flex-col justify-between border-b md:border-b-0 md:border-r border-ink/15">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft"
            >
              <span className="px-3 py-1 rounded-full bg-accent text-paper tnum">
                Session №{sessionNo ?? '—'}
              </span>
              <span>/</span>
              <span>Live screening · Voice</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="mt-8 font-display font-extrabold uppercase tracking-[-0.04em]"
              style={{ fontSize: 'clamp(72px, 13vw, 208px)', lineHeight: 0.82 }}
            >
              Screening<span className="text-accent">.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-10 max-w-xl text-[17px] sm:text-[20px] leading-[1.45] text-ink-muted"
            >
              A live voice conversation with Nisha — Cuemath&apos;s AI interviewer.
              She&apos;ll ask how you&apos;d teach and explain things to kids. No tricks,
              no multiple choice. Just talking.
            </motion.p>
          </div>

          {/* Metadata — editorial list */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-14 grid grid-cols-2 sm:grid-cols-3 border-t border-ink/15"
          >
            {META.map((m, i) => (
              <div
                key={m.label}
                className={
                  'px-5 py-5 border-b border-ink/15 ' +
                  (i % 3 !== 2 ? 'sm:border-r border-ink/15 ' : '') +
                  (i % 2 !== 1 ? 'border-r sm:border-r border-ink/15 ' : '')
                }
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft">
                  {m.label}
                </div>
                <div className="mt-2 font-display text-[22px] font-semibold tracking-[-0.02em]">
                  {m.value}
                </div>
              </div>
            ))}
          </motion.div>
        </section>

        {/* Right: form card */}
        <section className="relative col-span-12 md:col-span-5 lg:col-span-4 px-5 sm:px-10 py-14 md:py-20 flex items-center justify-center bg-paper-deep">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full max-w-[440px]"
          >
            <div className="corner-marks relative bg-paper border border-ink/20 shadow-soft-lg p-7 sm:p-9 rounded-[4px]">
              <span className="corner-bl" />
              <span className="corner-br" />

              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
                  {TAXONOMY}/FORM · 01
                </div>
                <span className="px-2.5 py-1 rounded-full bg-accent text-paper font-mono text-[10px] uppercase tracking-[0.24em]">
                  LIVE
                </span>
              </div>

              <h2
                className="mt-6 font-display font-extrabold uppercase tracking-[-0.04em]"
                style={{ fontSize: 'clamp(36px, 4.5vw, 56px)', lineHeight: 0.88 }}
              >
                Start your
                <br />
                interview<span className="text-accent">.</span>
              </h2>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft leading-[1.7]">
                Two fields. Nisha takes it from there.
              </p>

              <div className="mt-8 flex flex-col gap-6">
                <Field
                  label="Full name"
                  index="01"
                  value={name}
                  onChange={(v) => { setName(v); setError(''); }}
                  placeholder="Priya Shah"
                  disabled={loading}
                  autoFocus
                />
                <Field
                  label="Email address"
                  index="02"
                  value={email}
                  type="email"
                  onChange={(v) => { setEmail(v); setError(''); }}
                  onEnter={() => { if (!loading) submit(); }}
                  placeholder="priya@example.com"
                  disabled={loading}
                />

                {error && (
                  <div className="rounded-[4px] bg-tangerine/15 border-l-[3px] border-tangerine px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-tangerine">
                    ! {error}
                  </div>
                )}

                <button
                  onClick={submit}
                  disabled={loading || !name.trim() || !email.trim()}
                  className="group relative w-full flex items-center justify-between px-5 py-4 rounded-full bg-accent text-paper font-display text-[17px] font-medium tracking-[-0.01em] shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:ring-4 hover:ring-accent/30 disabled:bg-ink/30 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:ring-0 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <span>Creating your interview…</span>
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </>
                  ) : (
                    <>
                      <span>Start interview</span>
                      <span className="w-8 h-8 rounded-full bg-paper text-accent flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                        <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
                      </span>
                    </>
                  )}
                </button>

                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft leading-[1.8] text-center">
                  By continuing you agree your voice will be recorded for the
                  duration of the interview and used only for evaluation.
                </p>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* ── Footer ticker ───────────────────────────────────────────────── */}
      <footer className="bg-ink text-paper overflow-hidden border-t border-ink/15">
        <div className="marquee-track-fast flex gap-10 whitespace-nowrap font-display font-extrabold uppercase text-[18px] tracking-[-0.02em] py-4">
          {Array.from({ length: 2 }).flatMap((_, r) =>
            [
              'Nisha · AI Interviewer',
              'Adaptive difficulty',
              'Real-time evaluation',
              'Hiring-grade report',
              'Voice first',
              'Built end-to-end',
            ].map((t, i) => (
              <span key={`${r}-${i}`} className="flex items-center gap-10">
                <span>{t}</span>
                <span className="text-accent">◆</span>
              </span>
            )),
          )}
        </div>
      </footer>
    </div>
  );
}

// ─── Form field ─────────────────────────────────────────────────────────────

function Field({
  label,
  index,
  value,
  onChange,
  onEnter,
  placeholder,
  type = 'text',
  disabled,
  autoFocus,
}: {
  label: string;
  index: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft">
        <span>{label}</span>
        <span className="text-ink/30 tnum">{index}</span>
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className="mt-2 w-full bg-transparent border-b-[1.5px] border-ink/25 px-0 py-3 font-display text-[22px] sm:text-[24px] tracking-[-0.02em] text-ink placeholder:text-ink/25 outline-none focus:border-accent transition disabled:opacity-60"
      />
    </label>
  );
}
