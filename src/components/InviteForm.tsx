'use client';

import { useState, useRef } from 'react';
import { Mail, Loader2, Check, Copy, AlertTriangle } from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════════
// InviteForm — editorial single-invite form
// ═════════════════════════════════════════════════════════════════════════════

interface InviteFormProps {
  onSuccess: () => void;
}

export default function InviteForm({ onSuccess }: InviteFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{
    name: string;
    email: string;
    url: string;
    emailSent: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(null);

    if (!name.trim()) {
      setError("Please enter the candidate's name.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/interviews/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: name.trim(),
          candidate_email: email.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send invitation.');
        return;
      }

      setSuccess({
        name: name.trim(),
        email: email.trim(),
        url: data.interview_url,
        emailSent: data.email_sent,
      });
      setName('');
      setEmail('');
      onSuccess();
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    if (!success) return;
    navigator.clipboard.writeText(success.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fieldLabel = 'block font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-2';
  const underlineInput =
    'w-full bg-transparent border-b-[1.5px] border-ink/25 px-0 py-2.5 font-display text-[16px] tracking-[-0.01em] text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none transition';

  return (
    <section className="border border-ink/15 rounded-[4px] p-5 sm:p-7 bg-paper-deep/40">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          Single invite · 01
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft hidden sm:inline">
          Email + link
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Name */}
          <div>
            <label htmlFor="invite-name" className={fieldLabel}>
              <span className="mr-2 text-accent">/</span>Candidate name
            </label>
            <input
              id="invite-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              required
              className={underlineInput}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="invite-email" className={fieldLabel}>
              <span className="mr-2 text-accent">/</span>Candidate email
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. priya@example.com"
              required
              className={underlineInput}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="border-l-[3px] border-tangerine bg-tangerine/10 px-4 py-3 rounded-[4px] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-tangerine mt-0.5 shrink-0" strokeWidth={2} />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-tangerine mb-0.5">
                Error
              </div>
              <p className="font-display text-[15px] text-ink">{error}</p>
            </div>
          </div>
        )}

        {/* Submit */}
        <div>
          <button
            type="submit"
            disabled={sending}
            className={
              'group inline-flex items-center gap-3 pl-5 pr-2 py-2 rounded-full font-display font-semibold text-[15px] tracking-[-0.01em] transition ' +
              (sending
                ? 'bg-ink/30 text-paper cursor-not-allowed'
                : 'bg-accent text-paper hover:bg-accent-deep')
            }
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                Sending…
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" strokeWidth={2} />
                Send invitation
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-paper text-accent group-hover:translate-x-0.5 transition">
                  →
                </span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Success state ── */}
      {success && (
        <div className="mt-6 border-l-[3px] border-accent bg-accent/5 px-4 sm:px-5 py-4 rounded-[4px]">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full bg-accent text-paper font-mono text-[9px] uppercase tracking-[0.18em]">
              <Check className="w-3 h-3" strokeWidth={2.5} />
              Sent
            </span>
            <span className="font-display text-[15px] font-medium text-ink">
              {success.name}
            </span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-3">
            {success.emailSent
              ? `Delivered → ${success.email}`
              : `Email skipped — copy link manually`}
          </p>

          {/* Copy link row */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              ref={linkRef}
              type="text"
              readOnly
              value={success.url}
              className="flex-1 px-3 py-2 rounded-[4px] border border-ink/15 bg-paper font-mono text-[12px] tnum text-ink-muted focus:border-accent focus:outline-none truncate"
              onClick={() => linkRef.current?.select()}
            />
            <button
              onClick={copyLink}
              type="button"
              className={
                'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] transition ' +
                (copied
                  ? 'bg-accent text-paper'
                  : 'border border-ink/25 text-ink hover:bg-ink hover:text-paper')
              }
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" strokeWidth={2.5} />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" strokeWidth={2} />
                  Copy link
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
