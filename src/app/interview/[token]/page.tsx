import { getInterview } from '@/lib/supabase';
import InterviewRoom from '@/components/InterviewRoom';

// ─── Page Props ─────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ token: string }>;
}

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps) {
  const { token } = await params;
  const interview = await getInterview(token);

  return {
    title: interview
      ? 'Cuemath Tutor Screening'
      : 'Interview Not Found — Cuemath',
    description: interview
      ? 'Your AI-powered tutor screening interview with Cuemath.'
      : 'This interview link is invalid or has already been used.',
  };
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function InterviewPage({ params }: PageProps) {
  const { token } = await params;
  const interview = await getInterview(token);

  // ── Not found or already used ──
  const isSevenDaysOld =
    new Date(interview?.created_at || Date.now()).getTime() <
    Date.now() - 7 * 24 * 60 * 60 * 1000;

  if (!interview || interview.status !== 'scheduled' || isSevenDaysOld) {
    const isUsed =
      interview?.status === 'completed' || interview?.status === 'in_progress';

    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col">
        <header className="border-b border-ink/15">
          <div className="mx-auto max-w-[960px] px-5 sm:px-10 py-3.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
            <div className="flex items-center gap-2 text-ink">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span>Link / Unavailable</span>
            </div>
            <span className="font-display font-semibold normal-case text-[15px] tracking-normal text-ink">
              Cue<span className="text-accent">math</span>
            </span>
          </div>
        </header>

        <main className="flex-1 mx-auto max-w-[1100px] w-full px-5 sm:px-10 py-16 md:py-24 relative grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-3 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
            <div className="text-ink">/ 404 · Issue</div>
            <div className="mt-2 tnum">#TSR-2026/ERR</div>
          </div>

          <div className="col-span-12 md:col-span-9 relative">
            {/* Sticker accent */}
            <div
              className="sticker-a hidden md:flex absolute -top-6 right-0 w-[84px] h-[84px] rounded-full bg-accent text-paper items-center justify-center shadow-soft font-display font-extrabold text-[22px] tracking-[-0.02em]"
              aria-hidden
            >
              404
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-ink/20 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft">
              Issue №404 · {isUsed ? 'Already Used' : 'Invalid Link'}
            </div>
            <h1
              className="mt-6 font-display font-extrabold uppercase tracking-[-0.04em]"
              style={{ fontSize: 'clamp(56px, 10vw, 144px)', lineHeight: 0.84 }}
            >
              {isUsed ? 'Already complete' : 'Link not found'}
              <span className="text-accent">.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-muted">
              {isUsed
                ? 'This interview has already been completed. Each link is valid for a single session.'
                : 'This interview link has expired or is invalid. Please contact Cuemath for a new link.'}
            </p>

            <a
              href="/"
              className="group mt-10 inline-flex items-center gap-3 bg-accent text-paper font-display text-[16px] font-medium tracking-[-0.01em] px-6 py-3.5 rounded-full shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:ring-4 hover:ring-accent/30"
            >
              Return home
              <span className="w-7 h-7 rounded-full bg-paper text-accent flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                →
              </span>
            </a>
          </div>
        </main>
      </div>
    );
  }

  // ── Valid interview ──
  return <InterviewRoom interview={interview} />;
}
