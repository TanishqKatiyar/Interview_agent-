import { Settings, Wrench } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="max-w-[900px]">
      {/* Masthead */}
      <section className="mb-10">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Admin · 06 / 06 · Settings
        </div>
        <h1
          className="font-display font-extrabold tracking-[-0.03em] text-ink"
          style={{ fontSize: 'clamp(44px, 8vw, 96px)', lineHeight: 0.9 }}
        >
          Settings.
        </h1>
        <div className="mt-4 max-w-[620px] grid grid-cols-12 gap-4">
          <div className="col-span-12 sm:col-span-3 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft pt-1">
            / Note
          </div>
          <p className="col-span-12 sm:col-span-9 font-display text-[17px] leading-[1.45] text-ink-muted tracking-[-0.01em]">
            Manage Cuemath Screener preferences and admin account details.
          </p>
        </div>
        <div className="mt-6 h-[1.5px] bg-ink" />
      </section>

      {/* Profile panel */}
      <section className="border border-ink/15 rounded-[4px] bg-paper-deep/40 mb-8">
        <div className="px-6 py-5 border-b border-ink/10 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-1">
              / 01 · Profile
            </div>
            <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-ink">
              Profile settings
            </h2>
          </div>
          <Settings className="w-4 h-4 text-ink-soft" strokeWidth={1.8} />
        </div>

        <div className="px-6 py-16 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-paper-deep border border-ink/15 mb-4">
            <Wrench className="w-5 h-5 text-ink-soft" strokeWidth={1.8} />
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent mb-2">
            / Coming soon
          </div>
          <p className="font-display text-[17px] text-ink tracking-[-0.01em] max-w-sm mx-auto">
            Settings module is under development. More configurations will be available shortly.
          </p>
        </div>
      </section>

      {/* About panel */}
      <section className="border border-ink/15 rounded-[4px] p-6 bg-paper-deep/40">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-4">
          / 02 · About
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Version', value: '1.0' },
            { label: 'Build', value: '2026.04' },
            { label: 'Codename', value: 'Tokyo' },
            { label: 'Status', value: 'Stable' },
          ].map((item) => (
            <div key={item.label} className="border-l-[1.5px] border-ink/15 pl-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-1">
                {item.label}
              </div>
              <div className="font-display text-[17px] font-semibold text-ink tracking-[-0.01em] tnum">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
