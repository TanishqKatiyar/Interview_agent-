'use client';

import { useState } from 'react';
import InviteForm from '@/components/InviteForm';
import InvitationList from '@/components/InvitationList';
import CsvUpload from '@/components/CsvUpload';

export default function InvitePage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div>
      {/* Masthead */}
      <section className="mb-10">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Admin · 02 / 06 · Invite
        </div>
        <h1
          className="font-display font-extrabold tracking-[-0.03em] text-ink"
          style={{ fontSize: 'clamp(44px, 8vw, 96px)', lineHeight: 0.9 }}
        >
          Invite.
        </h1>
        <div className="mt-4 max-w-[620px] grid grid-cols-12 gap-4">
          <div className="col-span-12 sm:col-span-3 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft pt-1">
            / Note
          </div>
          <p className="col-span-12 sm:col-span-9 font-display text-[17px] leading-[1.45] text-ink-muted tracking-[-0.01em]">
            Send interview links to tutor candidates. They&apos;ll get an email with a unique token.
          </p>
        </div>
        <div className="mt-6 h-[1.5px] bg-ink" />
      </section>

      {/* Single invite */}
      <div className="mb-8">
        <InviteForm onSuccess={refresh} />
      </div>

      {/* Divider with label */}
      <div className="flex items-center gap-4 my-10">
        <div className="flex-1 h-px bg-ink/15" />
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft whitespace-nowrap">
          Or invite multiple
        </span>
        <div className="flex-1 h-px bg-ink/15" />
      </div>

      {/* Bulk CSV */}
      <div className="mb-12">
        <CsvUpload onComplete={refresh} />
      </div>

      {/* Recent invitations */}
      <InvitationList refreshKey={refreshKey} />
    </div>
  );
}
