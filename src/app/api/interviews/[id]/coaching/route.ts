// GET /api/interviews/[id]/coaching
// Returns coaching_feedback for the candidate's post-interview screen.

import { NextRequest, NextResponse } from 'next/server';
import { getInterviewById } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Missing interview id' }, { status: 400 });
  }

  try {
    const interview = await getInterviewById(id);
    if (!interview) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      coaching_feedback: interview.coaching_feedback ?? null,
    });
  } catch (err) {
    console.error('[coaching] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
