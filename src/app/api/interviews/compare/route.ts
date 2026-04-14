import { NextRequest, NextResponse } from 'next/server';
import { generateComparisonSummary } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { candidates } = await req.json();

    if (!Array.isArray(candidates) || candidates.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 candidates required for comparison' },
        { status: 400 },
      );
    }

    const summary = await generateComparisonSummary(candidates);

    return NextResponse.json({ summary });
  } catch (err) {
    console.error('[compare-api] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
