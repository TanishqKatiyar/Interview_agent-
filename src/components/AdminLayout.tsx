'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import NotificationBell from './NotificationBell';

// ═════════════════════════════════════════════════════════════════════════════
// AdminLayout — club-style shell for admin pages
// Auth gating intentionally removed so reviewers can browse freely.
// ═════════════════════════════════════════════════════════════════════════════

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const stamp = now
    ? `${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} · ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : '—';

  return (
    <div className="min-h-screen bg-paper text-ink">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-[264px] min-h-screen flex flex-col">
        {/* Top bar — shared across admin pages */}
        <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-sm border-b border-ink/15">
          <div className="flex items-center justify-between px-4 sm:px-8 py-3">
            {/* Mobile hamburger */}
            <div className="flex items-center gap-3 lg:hidden">
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-paper-deep border border-ink/15 hover:bg-ink hover:text-paper transition"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" strokeWidth={1.8} />
              </button>
              <Link href="/" className="font-display font-semibold text-[16px] tracking-[-0.01em] hover:opacity-70 transition">
                Cue<span className="text-accent">math</span>
              </Link>
            </div>

            {/* Desktop: timestamp */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-paper-deep border border-ink/15 font-mono text-[11px] uppercase tracking-[0.28em] text-ink-soft">
              <span className="flex items-center gap-2 text-ink">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Live Console
              </span>
              <span className="text-ink/25">·</span>
              <span className="tnum text-ink">{stamp}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden md:inline-flex items-center px-3 py-1.5 rounded-full bg-paper-deep border border-ink/15 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
                Admin · v1.0
              </span>
              <NotificationBell />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-8">
          <div className="max-w-[1400px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
