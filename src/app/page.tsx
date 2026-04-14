'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowUpRight,
  Mic,
  LayoutDashboard,
  ClipboardList,
  Plus,
} from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════════
// / (Landing) — Tokyo palette · wodniack.dev structural DNA
// Warm cream canvas · deep warm ink · signature red · editorial bento grid
// ═════════════════════════════════════════════════════════════════════════════

const TICKER_ITEMS = [
  'Built by Tanishq Katiyar',
  'End-to-end voice AI',
  'Next.js 16',
  'Supabase',
  'Groq',
  'Gemini',
  'Edge TTS',
  'Deepgram',
  'React 19',
  'Portfolio · 2026',
];

// Wodniack-style taxonomy: project code, item number, total
const TAXONOMY = '#TSR-2026';

const TILES = [
  {
    code: '#TSR-0001/03',
    index: '01',
    eyebrow: 'Candidate entry',
    title: 'Take an interview',
    blurb:
      'Enter your name and email, then jump straight into a live voice screening with Nisha — the AI interviewer.',
    href: '/interview',
    Icon: Mic,
    chipLabel: 'LIVE',
    // Featured tile — biggest span, red accent
    span: 'md:col-span-7 lg:col-span-7',
    featured: true,
  },
  {
    code: '#TSR-0002/03',
    index: '02',
    eyebrow: 'Hiring team',
    title: 'Admin dashboard',
    blurb:
      'Review past interviews, generate links, browse the assessment engine.',
    href: '/admin',
    Icon: LayoutDashboard,
    chipLabel: 'INSIGHTS',
    span: 'md:col-span-5 lg:col-span-5',
    featured: false,
  },
  {
    code: '#TSR-0003/03',
    index: '03',
    eyebrow: 'Anonymous mock',
    title: 'Practice mode',
    blurb:
      'Two questions, no record kept. The fastest way to hear the voice interviewer talk.',
    href: '/practice',
    Icon: ClipboardList,
    chipLabel: 'DEMO',
    span: 'md:col-span-12 lg:col-span-12',
    featured: false,
  },
];

// ─── Binary tape — wodniack signature editorial divider ─────────────────────

function BinaryStrip({ text }: { text: string }) {
  // Encode text as binary for the tape
  const binary = text
    .split('')
    .map((c) => c.charCodeAt(0).toString(2).padStart(8, '0'))
    .join(' ');
  const filler = '0010110 11010 001101 1010010 0101101 '.repeat(4);
  return (
    <div className="overflow-hidden py-3 bg-ink text-paper/70 border-y border-paper/10">
      <div className="binary-track flex gap-8 whitespace-nowrap font-mono text-[10px] tracking-[0.12em] uppercase">
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className="flex items-center gap-8">
            <span className="text-accent">◆</span>
            <span>{TAXONOMY}</span>
            <span className="text-paper/30">·</span>
            <span className="tnum">{binary}</span>
            <span className="text-paper/30">·</span>
            <span className="tnum">{filler}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Corner registration marks ──────────────────────────────────────────────

function CornerMarks() {
  return (
    <>
      <span className="corner-bl" />
      <span className="corner-br" />
    </>
  );
}

export default function Home() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const targets = document.querySelectorAll('.fill-text > span');
    if (targets.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    targets.forEach((target) => {
      gsap.to(target, {
        backgroundSize: '200% 200%',
        ease: 'none',
        scrollTrigger: {
          trigger: '.fill-text',
          start: 'top 80%',
          end: 'bottom 35%',
          scrub: true,
        },
      });
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col overflow-hidden">
      {/* ── Editorial top strip ───────────────────────────────────────────── */}
      <header className="border-b border-ink/15">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-10 py-3.5 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.28em] text-ink-soft">
          <div className="flex items-center gap-2 text-ink">
            <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span>Cuemath / Tutor Screener</span>
          </div>
          <div className="hidden sm:block tnum">{TAXONOMY} · Edition 01</div>
          <div className="tnum">2026 / v1.0</div>
        </div>
      </header>

      {/* ── Hero masthead ─────────────────────────────────────────────────── */}
      <section className="relative border-b border-ink/15">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-10 pt-14 pb-12 md:pt-20 md:pb-20 grid grid-cols-12 gap-6">
          {/* Left: metadata rail */}
          <aside className="hidden lg:block col-span-2 pt-6">
            <div className="sticky top-8 space-y-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft">
                <div className="text-ink">Index</div>
                <div className="mt-2">01 · Hero</div>
                <div>02 · Brief</div>
                <div>03 · Entries</div>
                <div>04 · Colophon</div>
              </div>
              <div className="h-px bg-ink/20" />
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft">
                <div className="text-ink">Stack</div>
                <div className="mt-2">Next · 16</div>
                <div>React · 19</div>
                <div>Tailwind · 4</div>
                <div>Supabase</div>
                <div>Groq · Gemini</div>
              </div>
            </div>
          </aside>

          {/* Center: headline */}
          <div className="col-span-12 lg:col-span-10 relative">

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft"
            >
              <span className="px-3 py-1 rounded-full bg-ink text-paper">Voice AI</span>
              <span>/</span>
              <span>Hiring-grade screening</span>
              <span>/</span>
              <span>Built end-to-end</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="mt-10 font-display font-extrabold uppercase tracking-[-0.04em]"
              style={{ fontSize: 'clamp(64px, 14vw, 232px)', lineHeight: 0.82 }}
            >
              AI Tutor
              <br />
              Screener<span className="text-accent">.</span>
            </motion.h1>

            <div className="mt-10 grid grid-cols-12 gap-6">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="col-span-12 md:col-span-7 text-[17px] sm:text-[20px] leading-[1.45] text-ink-muted"
              >
                A fully automated voice interview platform — live conversation
                with an AI interviewer, adaptive difficulty, real-time
                evaluation, and a hiring-grade assessment report. No boring
                screening calls.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="col-span-12 md:col-span-5 flex flex-col gap-3 md:items-end"
              >
                <Link
                  href="/interview"
                  className="group inline-flex items-center gap-3 rounded-full bg-accent text-paper font-display text-[16px] font-medium tracking-[-0.01em] px-6 py-3.5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:ring-4 hover:ring-accent/30"
                >
                  Start an interview
                  <span className="w-7 h-7 rounded-full bg-paper text-accent flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.4} />
                  </span>
                </Link>
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-5 py-3 font-display text-[15px] font-medium tracking-[-0.01em] text-ink hover:bg-ink hover:text-paper transition"
                >
                  See the dashboard →
                </Link>
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  onClick={() => document.getElementById('brief-section')?.scrollIntoView({ behavior: 'smooth' })}
                  aria-label="Scroll down"
                  className="inline-flex items-center gap-2 mt-2 cursor-pointer group"
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft group-hover:text-accent transition">
                    Scroll down
                  </span>
                  <motion.span
                    animate={{ y: [0, 4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="text-accent text-[14px]"
                  >
                    ↓
                  </motion.span>
                </motion.button>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Binary tape divider (wodniack signature) ──────────────────────── */}
      <BinaryStrip text="CUEMATH SCREENER 2026" />

      {/* ── Brief / about this build ──────────────────────────────────────── */}
      <section id="brief-section" className="border-b border-ink/15">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-10 py-16 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-3 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
            <div className="text-ink">/ 02 · Brief</div>
            <div className="mt-2 tnum">{TAXONOMY}/BR</div>
          </div>
          <div className="col-span-12 md:col-span-9">
            <p className="fill-text font-display text-[24px] sm:text-[34px] md:text-[40px] leading-[1.12] tracking-[-0.025em]">
              <span>
                Hi — I built this for{' '}
                <span className="relative inline-block" style={{ WebkitTextFillColor: '#F4EBD9' }}>
                  <span className="relative z-10 px-2">Cuemath</span>
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-accent -rotate-1 z-0"
                  />
                </span>
                {' '}as a response to a problem statement they shared, to demonstrate
                what an end-to-end tutor-screening system could look like. Every
                layer — the voice pipeline, the AI interviewer persona, the admin
                dashboard, the assessment engine — is built from scratch.
              </span>
            </p>
            <p className="mt-8 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-soft leading-[1.8] max-w-3xl">
              Nothing is gated. Click around. Start a mock interview, browse the
              dashboard, or create an interview link for yourself.
            </p>
          </div>
        </div>
      </section>

      {/* ── Entry tiles — asymmetric 12-col bento ─────────────────────────── */}
      <section className="border-b border-ink/15">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-10 py-14">
          <div className="mb-10 grid grid-cols-12 gap-6 items-end">
            <div className="col-span-12 md:col-span-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
                / 03 · Entries · <span className="tnum">{TAXONOMY}/EN</span>
              </div>
              <h2
                className="mt-4 font-display font-extrabold uppercase tracking-[-0.03em] text-ink"
                style={{ fontSize: 'clamp(40px, 6vw, 84px)', lineHeight: 0.92 }}
              >
                Three ways in.
              </h2>
            </div>
            <div className="col-span-12 md:col-span-4 text-[14px] leading-relaxed text-ink-muted md:text-right">
              Pick a tile. Every route is wired to live infrastructure — no mock
              data, no placeholders.
            </div>
          </div>

          <div className="grid grid-cols-12 gap-5">
            {TILES.map((tile, i) => (
              <motion.div
                key={tile.href}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.55, delay: i * 0.08 }}
                className={'col-span-12 ' + tile.span}
              >
                <Link
                  href={tile.href}
                  className={
                    'group corner-marks relative block h-full overflow-hidden rounded-[4px] border transition-all duration-300 ' +
                    (tile.featured
                      ? 'bg-accent text-paper border-accent min-h-[420px] hover:bg-accent-deep'
                      : 'bg-paper text-ink border-ink/20 min-h-[320px] hover:bg-ink hover:text-paper hover:border-ink')
                  }
                >
                  <CornerMarks />

                  {/* Top bar: taxonomy + chip */}
                  <div className="flex items-center justify-between px-7 sm:px-9 pt-8">
                    <span
                      className={
                        'font-mono text-[10px] uppercase tracking-[0.24em] tnum ' +
                        (tile.featured ? 'text-paper/80' : 'text-ink-soft group-hover:text-paper/70')
                      }
                    >
                      {tile.code}
                    </span>
                    <span
                      className={
                        'font-mono text-[10px] uppercase tracking-[0.24em] px-2.5 py-1 rounded-full ' +
                        (tile.featured
                          ? 'bg-paper text-accent'
                          : 'bg-ink text-paper group-hover:bg-paper group-hover:text-ink')
                      }
                    >
                      {tile.chipLabel}
                    </span>
                  </div>

                  {/* Oversized numeric index */}
                  <div
                    className={
                      'px-7 sm:px-9 mt-6 font-display font-extrabold leading-[0.82] tracking-[-0.04em] tnum ' +
                      (tile.featured ? 'text-paper/90' : 'text-ink/90 group-hover:text-paper/90')
                    }
                    style={{ fontSize: 'clamp(72px, 11vw, 168px)' }}
                  >
                    {tile.index}
                  </div>

                  {/* Bottom content */}
                  <div className="px-7 sm:px-9 pb-8 mt-8 flex items-end justify-between gap-6">
                    <div className="flex-1 max-w-md">
                      <div
                        className={
                          'font-mono text-[10px] uppercase tracking-[0.24em] mb-2 ' +
                          (tile.featured ? 'text-paper/70' : 'text-ink-soft group-hover:text-paper/60')
                        }
                      >
                        {tile.eyebrow}
                      </div>
                      <h3
                        className={
                          'font-display font-semibold tracking-[-0.025em] ' +
                          (tile.featured ? 'text-paper' : '')
                        }
                        style={{
                          fontSize: tile.featured ? 'clamp(30px, 3.6vw, 44px)' : 'clamp(24px, 2.8vw, 32px)',
                          lineHeight: 1.02,
                        }}
                      >
                        {tile.title}
                      </h3>
                      <p
                        className={
                          'mt-3 text-[14px] sm:text-[15px] leading-relaxed ' +
                          (tile.featured ? 'text-paper/80' : 'text-ink-muted group-hover:text-paper/80')
                        }
                      >
                        {tile.blurb}
                      </p>
                    </div>

                    <span
                      className={
                        'shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-105 ' +
                        (tile.featured
                          ? 'bg-paper text-accent'
                          : 'bg-ink text-paper group-hover:bg-paper group-hover:text-ink')
                      }
                    >
                      <tile.Icon className="w-5 h-5" strokeWidth={1.8} />
                    </span>
                  </div>

                  {/* Enter rule */}
                  <div
                    className={
                      'border-t flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.24em] px-7 sm:px-9 py-4 ' +
                      (tile.featured
                        ? 'border-paper/20 text-paper/70'
                        : 'border-ink/15 text-ink-soft group-hover:border-paper/20 group-hover:text-paper/70')
                    }
                  >
                    <span className="flex items-center gap-2">
                      <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
                      Enter
                    </span>
                    <span className="tnum">{tile.code}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Colophon / specimen strip ─────────────────────────────────────── */}
      <section className="border-b border-ink/15">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-10 py-14 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-3 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
            <div className="text-ink">/ 04 · Colophon</div>
            <div className="mt-2 tnum">{TAXONOMY}/CO</div>
          </div>
          <div className="col-span-6 md:col-span-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft">Display</div>
            <div className="mt-2 font-display font-extrabold text-[48px] leading-none tracking-[-0.03em]">Aa</div>
            <div className="mt-2 font-mono text-[11px] tracking-[0.1em] text-ink-soft">Space Grotesk</div>
          </div>
          <div className="col-span-6 md:col-span-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft">Body</div>
            <div className="mt-2 text-[48px] leading-none tracking-[-0.02em]">Aa</div>
            <div className="mt-2 font-mono text-[11px] tracking-[0.1em] text-ink-soft">Geist Sans</div>
          </div>
          <div className="col-span-12 md:col-span-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft">Mono</div>
            <div className="mt-2 font-mono text-[48px] leading-none tracking-[-0.01em]">Aa</div>
            <div className="mt-2 font-mono text-[11px] tracking-[0.1em] text-ink-soft">Geist Mono</div>
          </div>
        </div>
      </section>

      {/* ── Marquee ───────────────────────────────────────────────────────── */}
      <section className="mt-auto">
        <div className="overflow-hidden py-5 bg-accent text-paper">
          <div className="marquee-track flex gap-10 whitespace-nowrap font-display font-extrabold uppercase text-[18px] sm:text-[24px] tracking-[-0.02em]">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} className="flex items-center gap-10">
                <span>{item}</span>
                <span className="text-paper/50">
                  <Plus className="w-5 h-5" strokeWidth={2.4} />
                </span>
              </span>
            ))}
          </div>
        </div>
        <footer className="mx-auto max-w-[1400px] w-full px-5 sm:px-10 py-6 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
          <div className="flex items-center gap-3">
            <span className="text-ink font-display font-semibold normal-case text-[15px] tracking-normal">
              Cue<span className="text-accent">math</span>
            </span>
            <span>/ Screener</span>
          </div>
          <div className="tnum">© 2026 / Portfolio showcase</div>
        </footer>
      </section>
    </div>
  );
}
