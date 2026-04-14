'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowRight, Lock } from 'lucide-react';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/admin');
        router.refresh();
      } else {
        setError(data.error || 'Invalid password');
        if (data.error !== 'Too many login attempts. Try again in 15 minutes.') {
          setTimeout(() => setError(''), 3000);
        }
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Top editorial bar */}
      <div className="absolute top-0 left-0 right-0 px-6 py-4 flex items-center justify-between border-b border-ink/15">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
          Cuemath // Screener
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Admin · Portal
        </div>
      </div>

      {/* Bottom wordmark strip */}
      <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-ink/15 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft text-center">
        / Tokyo · 2026 · Stable
      </div>

      <div className="w-full max-w-[440px]">
        {/* Masthead */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-5">
            <Lock className="w-3 h-3" strokeWidth={2} />
            / Restricted access
          </div>
          <h1
            className="font-display font-extrabold tracking-[-0.03em] text-ink"
            style={{ fontSize: 'clamp(44px, 8vw, 72px)', lineHeight: 0.9 }}
          >
            Sign in.
          </h1>
          <p className="mt-4 font-display text-[15px] text-ink-muted tracking-[-0.005em]">
            Enter the admin password to access the Cuemath Screener dashboard.
          </p>
        </div>

        {/* Card */}
        <div className="relative border border-ink/15 rounded-[4px] bg-paper-deep/40 p-7">
          {/* Top accent rule */}
          <div className="absolute top-0 left-0 h-[3px] w-16 bg-accent" />

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-2">
                / Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent border-b-[1.5px] border-ink/25 focus:border-accent text-ink px-0 py-3 pr-10 outline-none transition-colors placeholder:text-ink-soft/50 font-display text-[17px] tracking-[-0.01em]"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" strokeWidth={1.8} />
                  ) : (
                    <Eye className="w-4 h-4" strokeWidth={1.8} />
                  )}
                </button>
              </div>
              {error && (
                <div className="mt-4 border-l-[3px] border-accent bg-accent/5 pl-4 py-2.5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent mb-0.5">
                    / Error
                  </div>
                  <div className="font-display text-[14px] text-ink tracking-[-0.005em]">
                    {error}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full group inline-flex items-center justify-center gap-3 bg-ink text-paper hover:bg-accent disabled:bg-ink/40 disabled:cursor-not-allowed font-mono text-[11px] uppercase tracking-[0.22em] py-4 rounded-full transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-paper text-ink group-hover:bg-paper">
                    <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
                  </span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
