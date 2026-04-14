import { createClient } from '@supabase/supabase-js';
import type { Interview } from './types';

// ─── Supabase Client ────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Standard retry wrapper to boost resilience.
 */
async function withRetry<T>(
  operation: () => Promise<T>, 
  retries: number = 2, 
  delayMs: number = 1000
): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries) throw error;
      console.warn(`[DB] Attempt ${i + 1} failed, retrying in ${delayMs}ms`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Unreachable');
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Create a new interview with a generated UUID token.
 * Returns the newly created interview row.
 */
export async function createInterview(
  name: string,
  email: string,
): Promise<Interview> {
  return withRetry(async () => {
    const interview_token = crypto.randomUUID();

    const { data, error } = await supabase
      .from('interviews')
      .insert({
        candidate_name: name,
        candidate_email: email,
        interview_token,
        status: 'scheduled' as const,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create interview: ${error.message}`);
    return data as Interview;
  });
}

/**
 * Fetch a single interview by its shareable token.
 * Returns null when no matching row exists.
 */
export async function getInterview(
  token: string,
): Promise<Interview | null> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select()
      .eq('interview_token', token)
      .single();

    if (error && error.code === 'PGRST116') return null; // no rows
    if (error) throw new Error(`Failed to fetch interview: ${error.message}`);
    return data as Interview;
  });
}

/**
 * Partially update an interview by its primary key.
 */
export async function updateInterview(
  id: string,
  updates: Partial<Interview>,
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('interviews')
      .update(updates)
      .eq('id', id);

    if (error) throw new Error(`Failed to update interview: ${error.message}`);
  });
}

/**
 * Fetch a single interview by its primary key (UUID).
 * Returns null when no matching row exists.
 */
export async function getInterviewById(
  id: string,
): Promise<Interview | null> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) return null;

  return withRetry(async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select()
      .eq('id', id)
      .single();

    if (error && error.code === 'PGRST116') return null;
    if (error) throw new Error(`Failed to fetch interview: ${error.message}`);
    return data as Interview;
  });
}

/**
 * List the most recent interviews, ordered by created_at descending.
 */
export async function listInterviews(
  limit: number = 50,
): Promise<Interview[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select()
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to list interviews: ${error.message}`);
    return (data ?? []) as Interview[];
  });
}

/**
 * Upload an audio recording to the 'recordings' storage bucket.
 * Returns the public URL of the uploaded file.
 */
export async function uploadAudio(
  interviewId: string,
  blob: Blob,
): Promise<string> {
  return withRetry(async () => {
    const filePath = `${interviewId}/${Date.now()}.webm`;

    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(filePath, blob, {
        contentType: 'audio/webm',
        upsert: false,
      });

    if (uploadError) throw new Error(`Failed to upload audio: ${uploadError.message}`);

    const { data } = supabase.storage.from('recordings').getPublicUrl(filePath);
    return data.publicUrl;
  });
}
