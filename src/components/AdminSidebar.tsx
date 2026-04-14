'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Mail,
  Brain,
  BarChart3,
  Radio,
  Settings,
  X,
} from 'lucide-react';

// ─── Nav items ──────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/admin',            label: 'Dashboard',  Icon: LayoutDashboard },
  { href: '/admin/invite',     label: 'Invite',     Icon: Mail },
  { href: '/admin/insights',   label: 'Insights',   Icon: Brain },
  { href: '/admin/analytics',  label: 'Analytics',  Icon: BarChart3 },
  { href: '/admin/monitoring', label: 'Monitoring', Icon: Radio },
  { href: '/admin/settings',   label: 'Settings',   Icon: Settings },
];

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          onClick={onClose}
          className="lg:hidden fixed inset-0 bg-ink/40 backdrop-blur-sm z-40"
          aria-hidden
        />
      )}

      <aside
        className={
          'fixed top-0 bottom-0 z-50 w-[264px] bg-paper-deep flex flex-col ' +
          'border-r border-ink/10 transition-transform duration-200 ' +
          (open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
        }
      >
        {/* ── Masthead ── */}
        <div className="relative px-5 py-6 border-b border-ink/15">
          <Link href="/" onClick={onClose} className="block">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Admin / Screener
            </div>
            <div className="mt-3 font-display font-extrabold uppercase text-[30px] leading-[0.9] tracking-[-0.03em]">
              Cue<span className="text-accent">math</span>
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft tnum">
              #TSR-2026
            </div>
          </Link>

          {/* Close X on mobile */}
          <button
            onClick={onClose}
            className="lg:hidden absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full border border-ink/20 hover:bg-ink hover:text-paper transition"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="px-3 pb-3 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
            / Navigate
          </div>
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item, i) => {
              const active = isActive(item.href);
              const idx = String(i + 1).padStart(2, '0');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={
                      'group flex items-center gap-3 px-3 py-2.5 rounded-[4px] transition-all ' +
                      (active
                        ? 'bg-accent text-paper'
                        : 'text-ink hover:bg-paper')
                    }
                  >
                    <span
                      className={
                        'w-8 h-8 flex items-center justify-center transition ' +
                        (active
                          ? 'bg-paper text-accent rounded-[4px]'
                          : 'border border-ink/20 text-ink rounded-[4px] group-hover:bg-ink group-hover:text-paper group-hover:border-ink')
                      }
                    >
                      <item.Icon className="w-4 h-4" strokeWidth={1.8} />
                    </span>
                    <span className="font-display text-[16px] font-semibold tracking-[-0.01em] flex-1">
                      {item.label}
                    </span>
                    <span
                      className={
                        'font-mono text-[10px] tracking-[0.18em] tnum ' +
                        (active ? 'text-paper/60' : 'text-ink-soft')
                      }
                    >
                      {idx}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Footer card ── */}
        <div className="px-4 pb-5">
          <div className="rounded-[4px] border border-ink/20 p-4">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
              <span>v1.0</span>
              <span className="tnum">2026</span>
            </div>
            <div className="mt-2 font-display text-[16px] font-semibold tracking-[-0.02em]">
              Portfolio showcase
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
              Built for evaluation
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
