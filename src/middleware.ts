import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Admin-auth gating has been removed so reviewers can browse the showcase freely.
// Middleware adds security headers to all matched routes.

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // HSTS — enforce HTTPS in production
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/api/interviews/:path*'],
};
