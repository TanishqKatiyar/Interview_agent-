import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession } from '@/lib/auth';

export async function POST() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('admin_session')?.value;

  if (sessionToken) {
    destroySession(sessionToken);
  }

  cookieStore.delete('admin_session');
  return NextResponse.json({ success: true });
}
