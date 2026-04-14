'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, X, AlertTriangle, FileText } from 'lucide-react';
import { listInterviews } from '@/lib/supabase';
import type { Interview } from '@/lib/types';

// ─── localStorage helpers ───────────────────────────────────────────────────

const STORAGE_KEY = 'cuemath_read_assessments';

function getReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markAsRead(id: string) {
  const ids = getReadIds();
  ids.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

function markAllAsRead(ids: string[]) {
  const existing = getReadIds();
  ids.forEach((id) => existing.add(id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing]));
}

// ─── Time ago helper ────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

// ─── Recommendation chip ────────────────────────────────────────────────────

type ChipVariant = 'strong' | 'pass' | 'borderline' | 'fail' | 'pending';

function recChip(rec: string | null): { label: string; variant: ChipVariant; Icon: typeof Check } {
  switch (rec) {
    case 'strong_pass': return { label: 'Strong Pass', variant: 'strong',     Icon: Check };
    case 'pass':        return { label: 'Pass',        variant: 'pass',       Icon: Check };
    case 'borderline':  return { label: 'Borderline',  variant: 'borderline', Icon: AlertTriangle };
    case 'fail':        return { label: 'Fail',        variant: 'fail',       Icon: X };
    default:            return { label: 'Pending',     variant: 'pending',    Icon: FileText };
  }
}

function chipClasses(variant: ChipVariant): string {
  switch (variant) {
    case 'strong':     return 'bg-ink text-paper';
    case 'pass':       return 'bg-accent text-paper';
    case 'borderline': return 'bg-sunshine text-ink';
    case 'fail':       return 'bg-tangerine/15 text-tangerine';
    default:           return 'bg-paper-muted text-ink-soft';
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// NotificationBell — club-inspired
// ═════════════════════════════════════════════════════════════════════════════

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assessedInterviews, setAssessedInterviews] = useState<Interview[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // ── Fetch assessed interviews & compute unread ──
  const fetchNotifications = useCallback(async () => {
    try {
      const all = await listInterviews(100);
      const assessed = all
        .filter((i) => i.status === 'assessed')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20);

      setAssessedInterviews(assessed);

      const readIds = getReadIds();
      const unread = assessed.filter((i) => !readIds.has(i.id)).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('[NotificationBell] Failed to fetch:', err);
    }
  }, []);

  // Initial fetch + polling every 15s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleItemClick = (interview: Interview) => {
    markAsRead(interview.id);
    setUnreadCount((c) => Math.max(0, c - 1));
    setOpen(false);
    router.push(`/admin/${interview.id}`);
  };

  const handleMarkAllRead = () => {
    markAllAsRead(assessedInterviews.map((i) => i.id));
    setUnreadCount(0);
  };

  const recent = assessedInterviews.slice(0, 10);
  const readIds = getReadIds();

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative w-10 h-10 flex items-center justify-center rounded-full bg-paper-deep border border-ink/10 hover:bg-ink hover:text-paper transition shadow-soft"
      >
        <Bell className="w-4 h-4" strokeWidth={1.8} />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-tangerine text-paper font-mono text-[10px] font-bold tracking-[0.05em]"
            aria-label={`${unreadCount} unread`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute top-full right-0 mt-3 w-[360px] max-h-[460px] bg-paper rounded-[20px] border border-ink/10 shadow-soft-lg z-[100] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink/10">
            <div className="flex items-baseline gap-3">
              <span className="font-display font-semibold text-[16px] tracking-[-0.01em] text-ink">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent tnum">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft hover:text-ink transition"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Items */}
          <div className="overflow-y-auto flex-1">
            {recent.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                  Empty
                </div>
                <div className="mt-2 font-display text-[15px] text-ink-muted">
                  No assessments yet
                </div>
              </div>
            ) : (
              recent.map((interview, idx) => {
                const chip = recChip(interview.recommendation);
                const isUnread = !readIds.has(interview.id);
                const ChipIcon = chip.Icon;

                return (
                  <button
                    key={interview.id}
                    onClick={() => handleItemClick(interview)}
                    className={
                      'group relative block w-full text-left px-4 py-3 transition ' +
                      (idx > 0 ? 'border-t border-ink/10 ' : '') +
                      'hover:bg-paper-deep'
                    }
                  >
                    {/* Unread marker */}
                    {isUnread && (
                      <span
                        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-accent"
                        aria-hidden
                      />
                    )}

                    <div className="flex items-start gap-3 pl-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-soft">
                          <span className="tnum">{String(idx + 1).padStart(2, '0')}</span>
                          <span>·</span>
                          <span>{timeAgo(interview.created_at)}</span>
                          {isUnread && (
                            <>
                              <span>·</span>
                              <span className="text-accent">New</span>
                            </>
                          )}
                        </div>

                        <div
                          className={
                            'mt-1 font-display text-[16px] leading-tight tracking-[-0.01em] truncate text-ink ' +
                            (isUnread ? 'font-semibold' : 'font-medium')
                          }
                        >
                          {interview.candidate_name}
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={
                              'inline-flex items-center gap-1 px-2 py-[3px] rounded-full font-mono text-[9px] uppercase tracking-[0.16em] ' +
                              chipClasses(chip.variant)
                            }
                          >
                            <ChipIcon className="w-3 h-3" strokeWidth={2} />
                            {chip.label}
                          </span>
                          <span className="font-mono text-[10px] tnum text-ink-soft">
                            {interview.overall_score?.toFixed(1) ?? '—'}/5
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {recent.length > 0 && (
            <div className="border-t border-ink/10 px-4 py-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft bg-paper-deep/60">
              <span>Feed · Live</span>
              <button
                onClick={() => { setOpen(false); router.push('/admin'); }}
                className="hover:text-ink transition"
              >
                View all →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
