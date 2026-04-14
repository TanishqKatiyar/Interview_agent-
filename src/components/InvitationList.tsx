'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, Copy, RefreshCw, Inbox } from 'lucide-react';
import { listInterviews } from '@/lib/supabase';
import type { Interview } from '@/lib/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

type InviteStatus = 'awaiting' | 'completed' | 'expired';

function inviteStatus(interview: Interview): InviteStatus {
  if (interview.status === 'completed' || interview.status === 'assessed') {
    return 'completed';
  }
  const age = Date.now() - new Date(interview.created_at).getTime();
  if (interview.status === 'scheduled' && age > SEVEN_DAYS_MS) {
    return 'expired';
  }
  return 'awaiting';
}

function statusChipClasses(st: InviteStatus): string {
  switch (st) {
    case 'awaiting':
      return 'bg-sunshine text-ink';
    case 'completed':
      return 'bg-accent text-paper';
    case 'expired':
      return 'bg-paper-muted text-ink-soft';
  }
}

function statusLabel(st: InviteStatus): string {
  switch (st) {
    case 'awaiting':
      return 'Awaiting';
    case 'completed':
      return 'Completed';
    case 'expired':
      return 'Expired';
  }
}

// ═════════════════════════════════════════════════════════════════════════════

interface InvitationListProps {
  refreshKey: number;
}

export default function InvitationList({ refreshKey }: InvitationListProps) {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    try {
      const all = await listInterviews(100);
      setInterviews(all);
    } catch (err) {
      console.error('Failed to load invitations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchInvitations();
  }, [fetchInvitations, refreshKey]);

  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const copyLink = (interview: Interview) => {
    const url = `${baseUrl}/interview/${interview.interview_token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(interview.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resendEmail = async (interview: Interview) => {
    setResending(interview.id);
    try {
      const res = await fetch('/api/interviews/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: interview.candidate_name,
          candidate_email: interview.candidate_email,
        }),
      });
      if (res.ok) {
        fetchInvitations();
      }
    } catch (err) {
      console.error('Resend failed:', err);
    } finally {
      setResending(null);
    }
  };

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">
          Recent invitations
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft tnum">
          {loading ? '—' : String(interviews.length).padStart(2, '0')} total
        </span>
      </div>

      <div className="border border-ink/15 rounded-[4px] overflow-hidden bg-paper">
        {loading ? (
          <div className="px-6 py-16 text-center font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
            Loading…
          </div>
        ) : interviews.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-paper-deep mb-3">
              <Inbox className="w-5 h-5 text-ink-soft" strokeWidth={1.8} />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2">
              Empty
            </div>
            <p className="font-display text-[15px] text-ink-muted max-w-xs mx-auto">
              No invitations yet. Use the form above to invite your first candidate.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink/15 bg-paper-deep/40">
                  {['/ Candidate', '/ Email', '/ Sent', '/ Status', '/ Link', '/ Action'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {interviews.map((interview, idx) => {
                  const st = inviteStatus(interview);
                  const isCopied = copiedId === interview.id;
                  const isResending = resending === interview.id;

                  return (
                    <tr
                      key={interview.id}
                      className={
                        'group transition ' +
                        (idx > 0 ? 'border-t border-ink/10 ' : '') +
                        'hover:bg-paper-deep/40'
                      }
                    >
                      <td className="px-4 py-3 font-display text-[15px] font-medium text-ink tracking-[-0.01em]">
                        {interview.candidate_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-ink-muted">
                        {interview.candidate_email}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft whitespace-nowrap tnum">
                        {relativeTime(interview.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            'inline-flex items-center px-2 py-[3px] rounded-full font-mono text-[9px] uppercase tracking-[0.18em] ' +
                            statusChipClasses(st)
                          }
                        >
                          {statusLabel(st)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => copyLink(interview)}
                          className={
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-[0.18em] transition ' +
                            (isCopied
                              ? 'bg-accent text-paper'
                              : 'border border-ink/20 text-ink hover:bg-ink hover:text-paper')
                          }
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3" strokeWidth={2.5} />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" strokeWidth={2} />
                              Copy
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {st === 'awaiting' && (
                          <button
                            onClick={() => resendEmail(interview)}
                            disabled={isResending}
                            className={
                              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-[0.18em] transition ' +
                              (isResending
                                ? 'border border-ink/10 text-ink-soft cursor-not-allowed'
                                : 'border border-accent/60 text-accent hover:bg-accent hover:text-paper hover:border-accent')
                            }
                          >
                            <RefreshCw
                              className={'w-3 h-3 ' + (isResending ? 'animate-spin' : '')}
                              strokeWidth={2}
                            />
                            {isResending ? 'Sending' : 'Resend'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
