import { NextResponse } from 'next/server';

// Admin auth has been removed for the Cuemath showcase. This endpoint stays as
// a stub so any lingering client callers resolve cleanly instead of 404-ing.

export async function GET() {
  return NextResponse.json({ authed: true });
}
