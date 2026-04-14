import crypto from 'crypto';

// In-memory session store (resets on server restart). Fine for MVP.
const activeSessions = new Map<string, { createdAt: number }>();
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function createSession(): string {
  const token = crypto.randomUUID();
  activeSessions.set(token, { createdAt: Date.now() });
  return token;
}

export function destroySession(token: string): void {
  activeSessions.delete(token);
}

export function verifyAdminSessionCookie(sessionToken: string | undefined | null): boolean {
  cleanExpiredSessions();
  if (!sessionToken) return false;
  
  const session = activeSessions.get(sessionToken);
  if (!session) return false;
  
  if (Date.now() - session.createdAt > SESSION_MAX_AGE_MS) {
    activeSessions.delete(sessionToken);
    return false;
  }
  
  return true;
}

export function verifyAdminSession(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return false;
  
  const tokenMatch = cookieHeader.match(/admin_session=([^;]+)/);
  if (!tokenMatch || !tokenMatch[1]) return false;
  
  return verifyAdminSessionCookie(tokenMatch[1]);
}

export function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (now - session.createdAt > SESSION_MAX_AGE_MS) {
      activeSessions.delete(token);
    }
  }
}
