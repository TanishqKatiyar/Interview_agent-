-- ============================================================================
-- Cuemath AI Tutor Screener — Supabase Schema
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================================

-- ─── Enable required extensions ─────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ─── Interviews table ───────────────────────────────────────────────────────

create table if not exists public.interviews (
  id               uuid          primary key default uuid_generate_v4(),
  candidate_name   text          not null,
  candidate_email  text          not null,
  status           text          not null default 'scheduled'
                                 check (status in ('scheduled', 'in_progress', 'completed', 'assessed')),
  interview_token  text          not null unique,
  started_at       timestamptz,
  completed_at     timestamptz,
  duration_seconds integer,
  transcript       jsonb,
  audio_url        text,
  assessment       jsonb,
  overall_score    numeric(3,1),
  recommendation   text,
  metadata         jsonb,
  created_at       timestamptz   not null default now()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

-- Fast lookup when a candidate opens their interview link
create index if not exists idx_interviews_token
  on public.interviews (interview_token);

-- Filtered queries on the admin dashboard (e.g. "show all in_progress")
create index if not exists idx_interviews_status
  on public.interviews (status);

-- Ordering / pagination on the admin list view
create index if not exists idx_interviews_created_at
  on public.interviews (created_at desc);

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table public.interviews enable row level security;

-- Permissive policy: allow all operations via the anon key for now.
-- TODO: tighten this before production — restrict to service_role for writes,
--       and limit anon reads to the candidate's own row via interview_token.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'interviews'
      and policyname = 'Allow all access for now'
  ) then
    execute $policy$
      create policy "Allow all access for now"
        on public.interviews
        for all
        using (true)
        with check (true)
    $policy$;
  end if;
end $$;

-- ─── Storage bucket for audio recordings ────────────────────────────────────
-- NOTE: Supabase does not support creating storage buckets via SQL.
-- Create the bucket manually in the Supabase Dashboard:
--
--   1. Go to Storage → New Bucket
--   2. Name:   recordings
--   3. Public: ON  (so getPublicUrl works without signed URLs)
--   4. Allowed MIME types: audio/webm, audio/ogg, audio/mp4
--   5. Max file size: 50 MB
--
-- Then add this storage policy in the Dashboard under Storage → Policies:
--
--   Policy name:  Allow public uploads
--   Allowed operation: INSERT
--   Target roles: anon, authenticated
--   Policy definition: true
--
-- Alternatively, run this SQL:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recordings', 'recordings', true, 52428800, ARRAY['audio/webm', 'audio/ogg', 'audio/mp4'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
CREATE POLICY "Allow public uploads"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'recordings');

DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
CREATE POLICY "Allow public reads"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'recordings');
-- ============================================================================
