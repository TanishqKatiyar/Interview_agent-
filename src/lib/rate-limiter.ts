class RateLimiter {
  private store: Map<string, { count: number, windowStart: number }> = new Map();
  
  /**
   * Check if a request is allowed
   * @param key - unique identifier (IP, session, interview ID)
   * @param maxRequests - max requests allowed in window
   * @param windowMs - time window in milliseconds
   * @returns { allowed: boolean, remaining: number, retryAfterMs: number }
   */
  check(key: string, maxRequests: number, windowMs: number): { allowed: boolean, remaining: number, retryAfterMs: number } {
    const now = Date.now();
    const entry = this.store.get(key);
    
    if (!entry || now - entry.windowStart > windowMs) {
      // New window
      this.store.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
    }
    
    if (entry.count >= maxRequests) {
      const retryAfter = windowMs - (now - entry.windowStart);
      return { allowed: false, remaining: 0, retryAfterMs: retryAfter };
    }
    
    entry.count++;
    return { allowed: true, remaining: maxRequests - entry.count, retryAfterMs: 0 };
  }
  
  // Clean old entries every 10 minutes to prevent memory leak
  cleanup(maxAgeMs: number = 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart > maxAgeMs) this.store.delete(key);
    }
  }
}

// Export singleton instances for different purposes
export const authLimiter = new RateLimiter();    // login attempts
export const ttsLimiter = new RateLimiter();     // TTS generation
export const chatLimiter = new RateLimiter();    // LLM calls
export const preflightLimiter = new RateLimiter(); // LLM preflight
export const sttLimiter = new RateLimiter();     // Whisper STT calls
export const inviteLimiter = new RateLimiter();  // invite sending
export const bulkInviteLimiter = new RateLimiter(); // bulk invite sending
export const assessLimiter = new RateLimiter();  // assessment triggering

// Cleanup every 10 minutes (handled gracefully inline for serverless, or on global interval in long-running nodes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    authLimiter.cleanup();
    ttsLimiter.cleanup();
    chatLimiter.cleanup();
    preflightLimiter.cleanup();
    sttLimiter.cleanup();
    inviteLimiter.cleanup();
    bulkInviteLimiter.cleanup();
    assessLimiter.cleanup();
  }, 10 * 60 * 1000);
}
