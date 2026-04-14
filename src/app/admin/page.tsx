'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Plus,
  Search,
  Copy,
  Check,
  ExternalLink,
  X,
  ArrowLeft,
  ArrowRight,
  GitCompare,
  Inbox,
  Loader2,
  Users,
  CalendarDays,
  TrendingUp,
  Gauge,
  Home,
} from 'lucide-react';
import { listInterviews } from '@/lib/supabase';
import type { Interview } from '@/lib/types';

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const TAXONOMY = '#TSR-2026';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateShort(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Recommendation chip ────────────────────────────────────────────────────

type RecVariant = 'strong' | 'pass' | 'borderline' | 'fail' | 'pending';

function recVariant(rec: string | null): { label: string; variant: RecVariant } {
  switch (rec) {
    case 'strong_pass': return { label: 'Strong Pass', variant: 'strong' };
    case 'pass':        return { label: 'Pass',        variant: 'pass' };
    case 'borderline':  return { label: 'Borderline',  variant: 'borderline' };
    case 'fail':        return { label: 'Fail',        variant: 'fail' };
    default:            return { label: 'Pending',     variant: 'pending' };
  }
}

function recChipClasses(variant: RecVariant): string {
  switch (variant) {
    case 'strong':     return 'bg-ink text-paper';
    case 'pass':       return 'bg-accent text-paper';
    case 'borderline': return 'bg-sunshine text-ink';
    case 'fail':       return 'bg-tangerine/15 text-tangerine';
    default:           return 'bg-paper-muted text-ink-soft';
  }
}

// ─── Status label ───────────────────────────────────────────────────────────

function statusLabel(status: string): string {
  switch (status) {
    case 'scheduled':   return 'Scheduled';
    case 'in_progress': return 'In Progress';
    case 'completed':   return 'Completed';
    case 'assessed':    return 'Assessed';
    default:            return status;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// AdminDashboard — Tokyo palette + wodniack editorial grid
// ═════════════════════════════════════════════════════════════════════════════

export default function AdminDashboard() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [recFilter, setRecFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lastUpdatedText, setLastUpdatedText] = useState('');
  const lastUpdatedRef = useRef<Date | null>(null);

  // ── Candidate Comparison Selection ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Create-interview modal ──
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createSending, setCreateSending] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resetCreateModal = () => {
    setShowCreate(false);
    setCreateName('');
    setCreateEmail('');
    setCreateError('');
    setCreatedUrl(null);
    setCopied(false);
  };

  // ── Fetch function ──
  const fetchInterviews = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const data = await listInterviews(500);
      setInterviews(data);
      const now = new Date();
      setLastUpdated(now);
      lastUpdatedRef.current = now;
    } catch (err) {
      console.error('Failed to load interviews:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const submitCreateInterview = async () => {
    setCreateError('');
    const name = createName.trim();
    const email = createEmail.trim();
    if (!name) { setCreateError('Please enter a name'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setCreateError('Please enter a valid email'); return; }
    setCreateSending(true);
    try {
      const res = await fetch('/api/interviews/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_name: name, candidate_email: email, send_email: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create interview');
      setCreatedUrl(data.interview_url);
      fetchInterviews(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCreateSending(false);
    }
  };

  const copyCreatedUrl = async () => {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  // ── Initial fetch + auto-refresh every 30s ──
  useEffect(() => {
    fetchInterviews(true);
    const interval = setInterval(() => fetchInterviews(false), 30000);
    return () => clearInterval(interval);
  }, [fetchInterviews]);

  // ── Update "last updated" text every 5s ──
  useEffect(() => {
    function update() {
      const ts = lastUpdatedRef.current;
      if (!ts) return;
      const diff = Math.floor((Date.now() - ts.getTime()) / 1000);
      if (diff < 5) setLastUpdatedText('Just now');
      else if (diff < 60) setLastUpdatedText(`${diff}s ago`);
      else setLastUpdatedText(`${Math.floor(diff / 60)}m ago`);
    }
    update();
    const timer = setInterval(update, 5000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  // ── Stats ──
  const assessed = interviews.filter((i) => i.status === 'assessed');
  const passCount = assessed.filter(
    (i) => i.recommendation === 'strong_pass' || i.recommendation === 'pass',
  ).length;
  const passRate = assessed.length > 0 ? Math.round((passCount / assessed.length) * 100) : 0;
  const avgScore =
    assessed.length > 0
      ? (assessed.reduce((sum, i) => sum + (i.overall_score ?? 0), 0) / assessed.length).toFixed(1)
      : '—';

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = interviews.filter(
    (i) => new Date(i.created_at).getTime() > weekAgo,
  ).length;

  // ── Asymmetric bento spans (wodniack-style) ──
  const stats: {
    code: string;
    label: string;
    value: string;
    Icon: typeof Users;
    tone: 'feature' | 'ink' | 'paper-dark' | 'paper-light';
    span: string;
  }[] = [
    { code: '01', label: 'Pass rate',         value: assessed.length > 0 ? `${passRate}%` : '—', Icon: TrendingUp,   tone: 'feature',     span: 'col-span-12 md:col-span-6 lg:col-span-5' },
    { code: '02', label: 'Total interviews',  value: interviews.length.toString(),               Icon: Users,        tone: 'ink',         span: 'col-span-12 md:col-span-6 lg:col-span-3' },
    { code: '03', label: 'This week',         value: thisWeek.toString(),                        Icon: CalendarDays, tone: 'paper-dark',  span: 'col-span-6  md:col-span-6 lg:col-span-2' },
    { code: '04', label: 'Avg score',         value: avgScore,                                   Icon: Gauge,        tone: 'paper-light', span: 'col-span-6  md:col-span-6 lg:col-span-2' },
  ];

  // ── Filters ──
  const filtered = useMemo(() => {
    let list = interviews;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.candidate_name.toLowerCase().includes(q) ||
          i.candidate_email.toLowerCase().includes(q),
      );
    }

    if (recFilter !== 'all') {
      if (recFilter === 'not_assessed') {
        list = list.filter((i) => !i.recommendation);
      } else {
        list = list.filter((i) => i.recommendation === recFilter);
      }
    }

    if (statusFilter !== 'all') {
      list = list.filter((i) => i.status === statusFilter);
    }

    return list;
  }, [interviews, search, recFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, recFilter, statusFilter]);

  const rowDelay = (i: number) => (reduceMotion ? 0 : Math.min(i * 0.03, 0.25));

  return (
    <div className="text-ink">
      {/* ── Masthead ───────────────────────────────────────────────────── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10 pb-8 border-b border-ink/15"
      >
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-ink/20 hover:bg-ink hover:text-paper transition"
              >
                <Home className="w-3 h-3" strokeWidth={2} />
                Home
              </Link>
              <span className="px-3 py-1 rounded-full bg-accent text-paper">/ 01 · Overview</span>
              <span className="tnum">{TAXONOMY}/OV</span>
            </div>
            <h1
              className="mt-6 font-display font-extrabold uppercase tracking-[-0.04em]"
              style={{ fontSize: 'clamp(56px, 10vw, 144px)', lineHeight: 0.82 }}
            >
              Dashboard<span className="text-accent">.</span>
            </h1>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-ink/20 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Updated
              <span className="text-ink tnum">{lastUpdatedText || '—'}</span>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="group inline-flex items-center gap-3 bg-accent text-paper font-display text-[16px] font-medium tracking-[-0.01em] px-5 py-3 rounded-full shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:ring-4 hover:ring-accent/30"
            >
              <Plus className="w-4 h-4" strokeWidth={2.2} />
              New interview
              <span className="w-7 h-7 rounded-full bg-paper text-accent flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.4} />
              </span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Stat strip · asymmetric bento ─────────────────────────────── */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08 }}
        className="grid grid-cols-12 gap-4 mb-10"
      >
        {stats.map((stat) => {
          const tones = {
            feature: {
              card: 'bg-accent text-paper border-accent',
              meta: 'text-paper/70',
              iconChip: 'bg-paper text-accent',
              value: 'text-paper',
              rule: 'border-paper/20',
              corners: true,
            },
            ink: {
              card: 'bg-ink text-paper border-ink',
              meta: 'text-paper/60',
              iconChip: 'bg-accent text-paper',
              value: 'text-paper',
              rule: 'border-paper/15',
              corners: false,
            },
            'paper-dark': {
              card: 'bg-paper-muted text-ink border-ink/20',
              meta: 'text-ink-soft',
              iconChip: 'bg-ink text-paper',
              value: 'text-ink',
              rule: 'border-ink/15',
              corners: false,
            },
            'paper-light': {
              card: 'bg-paper text-ink border-ink/20',
              meta: 'text-ink-soft',
              iconChip: 'bg-ink text-paper',
              value: 'text-ink',
              rule: 'border-ink/15',
              corners: false,
            },
          }[stat.tone];
          return (
            <div
              key={stat.label}
              className={
                (tones.corners ? 'corner-marks ' : '') +
                'relative rounded-[4px] border p-6 sm:p-7 flex flex-col justify-between min-h-[180px] shadow-soft ' +
                tones.card +
                ' ' +
                stat.span
              }
            >
              {tones.corners && (
                <>
                  <span className="corner-bl" />
                  <span className="corner-br" />
                </>
              )}
              <div className="flex items-start justify-between">
                <div className={'font-mono text-[10px] uppercase tracking-[0.24em] tnum ' + tones.meta}>
                  / {stat.code} · {stat.label}
                </div>
                <span className={'w-9 h-9 rounded-full flex items-center justify-center ' + tones.iconChip}>
                  <stat.Icon className="w-4 h-4" strokeWidth={1.8} />
                </span>
              </div>
              <div
                className={'mt-auto font-display font-extrabold leading-[0.82] tracking-[-0.04em] tnum ' + tones.value}
                style={{ fontSize: stat.tone === 'feature' ? 'clamp(64px, 7vw, 112px)' : 'clamp(40px, 5vw, 64px)' }}
              >
                {loading ? '—' : stat.value}
              </div>
              <div className={'mt-4 pt-3 border-t flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.24em] ' + tones.rule + ' ' + tones.meta}>
                <span>{TAXONOMY}</span>
                <span className="tnum">0{stat.code}/04</span>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* ── Compare banner ─────────────────────────────────────────────── */}
      {selectedIds.size > 1 && (
        <div className="rounded-[4px] bg-ink text-paper p-5 mb-8 flex items-center justify-between gap-4 flex-wrap shadow-soft border border-ink">
          <div className="flex items-center gap-4">
            <span className="w-10 h-10 rounded-full bg-accent text-paper flex items-center justify-center">
              <GitCompare className="w-4 h-4" strokeWidth={2} />
            </span>
            <div>
              <div className="font-display font-semibold text-[20px] tracking-[-0.02em]">
                Compare {selectedIds.size} candidates
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-paper/60">
                Max 3 / side-by-side evaluation
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="font-mono text-[10px] uppercase tracking-[0.24em] text-paper/70 hover:text-accent transition"
            >
              Clear
            </button>
            <button
              onClick={() => router.push(`/admin/compare?ids=${Array.from(selectedIds).join(',')}`)}
              className="rounded-full bg-accent text-paper px-5 py-2 font-display text-[14px] font-medium tracking-[-0.01em] hover:-translate-y-0.5 transition shadow-soft"
            >
              Compare selected →
            </button>
          </div>
        </div>
      )}

      {/* ── Filter row ─────────────────────────────────────────────────── */}
      <div className="rounded-[4px] border border-ink/20 bg-paper p-5 sm:p-6 mb-6">
        <div className="flex flex-wrap items-end gap-5">
          {/* Search */}
          <div className="flex-1 min-w-[240px]">
            <label className="block font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft mb-2">
              / Search · name or email
            </label>
            <div className="flex items-center gap-3 border-b-[1.5px] border-ink/25 focus-within:border-accent transition pb-2">
              <Search className="w-4 h-4 text-ink-soft flex-shrink-0" strokeWidth={1.8} />
              <input
                type="text"
                placeholder="Type to filter…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent font-display text-[18px] tracking-[-0.01em] text-ink placeholder:text-ink/25 outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-ink-soft hover:text-ink transition"
                  aria-label="Clear"
                >
                  <X className="w-4 h-4" strokeWidth={1.8} />
                </button>
              )}
            </div>
          </div>

          {/* Recommendation */}
          <div className="min-w-[180px]">
            <label className="block font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft mb-2">
              / Recommendation
            </label>
            <select
              value={recFilter}
              onChange={(e) => setRecFilter(e.target.value)}
              className="w-full border-b-[1.5px] border-ink/25 bg-transparent pb-2 pl-0 pr-7 font-display text-[16px] tracking-[-0.01em] text-ink outline-none focus:border-accent transition cursor-pointer appearance-none"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B5A50' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 4px center',
              }}
            >
              <option value="all">All</option>
              <option value="strong_pass">Strong Pass</option>
              <option value="pass">Pass</option>
              <option value="borderline">Borderline</option>
              <option value="fail">Fail</option>
              <option value="not_assessed">Not Assessed</option>
            </select>
          </div>

          {/* Status */}
          <div className="min-w-[180px]">
            <label className="block font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft mb-2">
              / Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border-b-[1.5px] border-ink/25 bg-transparent pb-2 pl-0 pr-7 font-display text-[16px] tracking-[-0.01em] text-ink outline-none focus:border-accent transition cursor-pointer appearance-none"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B5A50' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 4px center',
              }}
            >
              <option value="all">All</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="assessed">Assessed</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Index header ───────────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-3 px-1">
        <span>/ 02 · Interviews · <span className="tnum">{TAXONOMY}/IN</span></span>
        <span className="tnum text-ink">{filtered.length} total</span>
      </div>

      {/* ── Interview table ────────────────────────────────────────────── */}
      <div className="rounded-[4px] bg-paper border border-ink/20 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-3 text-ink-soft">
            <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.8} />
            <span className="font-mono text-[10px] uppercase tracking-[0.28em]">Loading interviews…</span>
          </div>
        ) : paginated.length === 0 ? (
          <div className="py-20 px-6 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-paper-deep border border-ink/15 flex items-center justify-center mb-4">
              <Inbox className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="font-display text-[24px] font-semibold tracking-[-0.02em]">
              {search || recFilter !== 'all' || statusFilter !== 'all' ? 'No matches' : 'No interviews yet'}
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
              {search || recFilter !== 'all' || statusFilter !== 'all'
                ? 'Adjust filters to see more'
                : 'Create your first interview link'}
            </div>
            {!search && recFilter === 'all' && statusFilter === 'all' && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-6 inline-flex items-center gap-2 bg-accent text-paper px-5 py-3 rounded-full font-display text-[15px] font-medium tracking-[-0.01em] shadow-soft hover:-translate-y-0.5 hover:ring-4 hover:ring-accent/30 transition"
              >
                <Plus className="w-4 h-4" strokeWidth={2} />
                New interview
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-paper-deep">
                    <th className="w-12 px-4 py-4 text-center" />
                    {['Candidate', 'Date', 'Duration', 'Score', 'Recommendation', 'Status'].map(
                      (h) => (
                        <th
                          key={h}
                          className={
                            'px-4 py-4 text-left font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft whitespace-nowrap ' +
                            (h === 'Score' ? 'text-right ' : '')
                          }
                        >
                          / {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((interview, i) => {
                    const rec = recVariant(interview.recommendation);
                    const isSelected = selectedIds.has(interview.id);

                    return (
                      <motion.tr
                        key={interview.id}
                        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: rowDelay(i) }}
                        onClick={() => router.push(`/admin/${interview.id}`)}
                        className="group border-t border-ink/10 cursor-pointer transition-colors hover:bg-paper-deep"
                      >
                        {/* Checkbox */}
                        <td
                          className="w-12 px-4 py-5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label className="inline-flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const newSet = new Set(selectedIds);
                                if (e.target.checked) {
                                  if (newSet.size >= 3) {
                                    alert('You can only compare up to 3 candidates at a time.');
                                    return;
                                  }
                                  newSet.add(interview.id);
                                } else {
                                  newSet.delete(interview.id);
                                }
                                setSelectedIds(newSet);
                              }}
                              className="sr-only"
                            />
                            <span
                              className={
                                'w-5 h-5 border-[1.5px] flex items-center justify-center transition-colors ' +
                                (isSelected
                                  ? 'bg-accent border-accent'
                                  : 'bg-paper border-ink/25 group-hover:border-ink')
                              }
                            >
                              {isSelected && <Check className="w-3 h-3 text-paper" strokeWidth={3} />}
                            </span>
                          </label>
                        </td>

                        {/* Candidate */}
                        <td className="px-4 py-5">
                          <div className="flex items-center gap-3">
                            <span className="w-9 h-9 rounded-full bg-paper-deep border border-ink/20 flex items-center justify-center font-display font-semibold text-[14px] text-ink tracking-[-0.01em]">
                              {interview.candidate_name.charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <div className="font-display text-[18px] font-semibold tracking-[-0.01em] leading-tight">
                                {interview.candidate_name}
                              </div>
                              <div className="mt-0.5 font-mono text-[11px] tracking-[0.1em] text-ink-soft">
                                {interview.candidate_email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-5 whitespace-nowrap">
                          <div className="font-mono text-[11px] uppercase tracking-[0.16em] tnum">
                            {formatDateShort(interview.created_at)}
                          </div>
                          <div className="mt-1 font-mono text-[10px] tracking-[0.14em] text-ink-soft tnum">
                            {formatTime(interview.created_at)}
                          </div>
                        </td>

                        {/* Duration */}
                        <td className="px-4 py-5 font-mono text-[13px] tnum">
                          {formatDuration(interview.duration_seconds)}
                        </td>

                        {/* Score */}
                        <td className="px-4 py-5 text-right">
                          <span className="font-display text-[24px] font-extrabold tracking-[-0.03em] tnum">
                            {interview.overall_score?.toFixed(1) ?? '—'}
                            <span className="ml-1 font-mono text-[11px] font-normal tracking-[0.12em] text-ink-soft">/5</span>
                          </span>
                        </td>

                        {/* Recommendation */}
                        <td className="px-4 py-5">
                          <span
                            className={
                              'inline-flex items-center px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.2em] whitespace-nowrap ' +
                              recChipClasses(rec.variant)
                            }
                          >
                            {rec.label}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-5">
                          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft whitespace-nowrap">
                            {statusLabel(interview.status)}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-ink/15 bg-paper-deep font-mono text-[10px] uppercase tracking-[0.24em] text-ink-soft">
                <span className="tnum">
                  {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-ink/20 bg-paper text-ink hover:bg-ink hover:text-paper transition disabled:opacity-30 disabled:hover:bg-paper disabled:hover:text-ink disabled:cursor-not-allowed"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                    Prev
                  </button>
                  <span className="px-2 tnum text-ink">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-ink/20 bg-paper text-ink hover:bg-ink hover:text-paper transition disabled:opacity-30 disabled:hover:bg-paper disabled:hover:text-ink disabled:cursor-not-allowed"
                  >
                    Next
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create-interview modal ─────────────────────────────────────── */}
      {showCreate && (
        <div
          onClick={resetCreateModal}
          className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="corner-marks relative bg-paper rounded-[4px] border border-ink/25 shadow-soft-lg w-full max-w-[480px] overflow-hidden"
          >
            <span className="corner-bl" />
            <span className="corner-br" />

            {/* Header bar */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-ink/15">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
                {createdUrl ? '/ Link · Ready' : '/ New · Interview'}
              </span>
              <button
                onClick={resetCreateModal}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-ink/20 hover:bg-ink hover:text-paper transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>

            <div className="px-6 py-7">
              {!createdUrl ? (
                <>
                  <h2
                    className="font-display font-extrabold uppercase tracking-[-0.04em]"
                    style={{ fontSize: 'clamp(32px, 4vw, 44px)', lineHeight: 0.88 }}
                  >
                    Create link<span className="text-accent">.</span>
                  </h2>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft leading-[1.8]">
                    Generates a shareable ID. No email sent.
                  </p>

                  <div className="mt-7 flex flex-col gap-5">
                    <ModalField
                      label="Candidate name"
                      index="01"
                      value={createName}
                      onChange={(v) => { setCreateName(v); setCreateError(''); }}
                      placeholder="Priya Shah"
                      disabled={createSending}
                      autoFocus
                    />
                    <ModalField
                      label="Candidate email"
                      index="02"
                      value={createEmail}
                      type="email"
                      onChange={(v) => { setCreateEmail(v); setCreateError(''); }}
                      onEnter={() => { if (!createSending) submitCreateInterview(); }}
                      placeholder="priya@example.com"
                      disabled={createSending}
                    />

                    {createError && (
                      <div className="rounded-[4px] bg-tangerine/15 border-l-[3px] border-tangerine px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-tangerine">
                        ! {createError}
                      </div>
                    )}
                  </div>

                  <div className="mt-8 flex gap-3">
                    <button
                      onClick={resetCreateModal}
                      disabled={createSending}
                      className="flex-1 rounded-full border border-ink/20 py-3 font-display text-[15px] font-medium tracking-[-0.01em] hover:bg-ink hover:text-paper transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitCreateInterview}
                      disabled={createSending || !createName.trim() || !createEmail.trim()}
                      className="flex-1 bg-accent text-paper py-3 rounded-full font-display text-[15px] font-medium tracking-[-0.01em] flex items-center justify-center gap-2 shadow-soft hover:-translate-y-0.5 hover:ring-4 hover:ring-accent/30 transition disabled:bg-ink/30 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:ring-0"
                    >
                      {createSending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating…
                        </>
                      ) : (
                        <>Create link →</>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-paper font-mono text-[10px] uppercase tracking-[0.24em]">
                    <span className="w-1.5 h-1.5 rounded-full bg-paper animate-pulse" />
                    Link ready
                  </div>
                  <h2
                    className="mt-4 font-display font-extrabold uppercase tracking-[-0.04em]"
                    style={{ fontSize: 'clamp(32px, 4vw, 44px)', lineHeight: 0.88 }}
                  >
                    Share the link<span className="text-accent">.</span>
                  </h2>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                    Valid 7 days · One-time entry
                  </p>

                  <div className="mt-6 rounded-[4px] bg-paper-deep border border-ink/15 px-4 py-3 font-mono text-[12px] text-ink break-all leading-relaxed">
                    {createdUrl}
                  </div>

                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={copyCreatedUrl}
                      className={
                        'flex-1 py-3 rounded-full font-display text-[15px] font-medium tracking-[-0.01em] flex items-center justify-center gap-2 transition ' +
                        (copied
                          ? 'bg-accent text-paper'
                          : 'bg-accent text-paper shadow-soft hover:-translate-y-0.5 hover:ring-4 hover:ring-accent/30')
                      }
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" strokeWidth={2} />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" strokeWidth={2} />
                          Copy link
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => createdUrl && window.open(createdUrl, '_blank', 'noopener')}
                      className="flex-1 rounded-full border border-ink/20 py-3 font-display text-[15px] font-medium tracking-[-0.01em] flex items-center justify-center gap-2 hover:bg-ink hover:text-paper transition"
                    >
                      <ExternalLink className="w-4 h-4" strokeWidth={2} />
                      Open
                    </button>
                  </div>

                  <button
                    onClick={resetCreateModal}
                    className="mt-5 w-full font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft hover:text-ink transition"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ─── Modal field ────────────────────────────────────────────────────────────

function ModalField({
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
        className="mt-2 w-full bg-transparent border-b-[1.5px] border-ink/25 px-0 py-3 font-display text-[20px] tracking-[-0.02em] text-ink placeholder:text-ink/25 outline-none focus:border-accent transition disabled:opacity-60"
      />
    </label>
  );
}
