import { supabase } from './supabase';

type LogLevel = 'info' | 'warn' | 'error';
type LogCategory = 'interview' | 'llm' | 'tts' | 'stt' | 'auth' | 'db' | 'api' | 'recovery' | 'preflight';

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  interview_id?: string;
  data?: Record<string, any>;
}

// Logger queues logs to batch them (avoid one API call per log event)
class Logger {
  private queue: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly FLUSH_INTERVAL = 5000; // flush every 5 seconds
  private readonly MAX_QUEUE_SIZE = 20;   // or when queue reaches 20 entries

  log(entry: LogEntry): void {
    // Always log to console (visible in dev + browser)
    const consoleMethod = entry.level === 'error' ? console.error
                        : entry.level === 'warn' ? console.warn
                        : console.log;
    consoleMethod(`[${entry.category.toUpperCase()}] ${entry.message}`, entry.data || '');

    // Queue for Supabase (fire-and-forget, don't block)
    this.queue.push(entry);

    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL);
    }
  }

  private async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) return;

    const toFlush = [...this.queue];
    this.queue = [];

    try {
      await supabase.from('logs').insert(
        toFlush.map(entry => ({
          level: entry.level,
          category: entry.category,
          message: entry.message,
          interview_id: entry.interview_id || null,
          data: entry.data || null,
        }))
      );
    } catch (error) {
      // Don't log the logging failure (infinite loop risk)
      console.error('[LOGGER] Failed to flush logs', error);
    }
  }

  // Force flush (call on interview end)
  async forceFlush(): Promise<void> {
    await this.flush();
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  drainQueue(): LogEntry[] {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const entries = [...this.queue];
    this.queue = [];
    return entries;
  }
}

const logger = new Logger();

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Use keepalive fetch so the request survives page unload
    if (logger.getQueueLength() === 0) return;
    const entries = logger.drainQueue();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;
    try {
      fetch(`${supabaseUrl}/rest/v1/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(entries.map(e => ({
          level: e.level,
          category: e.category,
          message: e.message,
          interview_id: e.interview_id || null,
          data: e.data || null,
        }))),
        keepalive: true,
      });
    } catch { /* best effort */ }
  });
}

// Convenience functions
export const logInfo = (category: LogCategory, message: string, data?: Record<string, any>, interview_id?: string) =>
  logger.log({ level: 'info', category, message, data, interview_id });

export const logWarn = (category: LogCategory, message: string, data?: Record<string, any>, interview_id?: string) =>
  logger.log({ level: 'warn', category, message, data, interview_id });

export const logError = (category: LogCategory, message: string, data?: Record<string, any>, interview_id?: string) =>
  logger.log({ level: 'error', category, message, data, interview_id });

export const forceFlushLogs = () => logger.forceFlush();
