import type { TranscriptEntry } from './types';
import { logInfo, logWarn, logError } from './logger';

export type ProviderResult = {
  name: 'groq' | 'gemini' | 'openrouter';
  healthy: boolean;
  latencyMs: number;
};

export type ProviderRanking = {
  primary: 'groq' | 'gemini' | 'openrouter' | null;
  fallback: 'groq' | 'gemini' | 'openrouter' | null;
  results: ProviderResult[];
};

// Global module state holding the ranking
let providerRanking: ProviderRanking = {
  primary: 'groq',    // Defaults
  fallback: 'gemini', // Defaults
  results: [],
};

let preflightCompleted = false;

/**
 * Runs a preflight check against all configured LLM providers in parallel.
 * Updates the global providerRanking.
 * Call this once before the interview starts (e.g., during mic setup).
 */
export async function preflightCheck(): Promise<ProviderRanking> {
  if (preflightCompleted) return providerRanking;

  try {
    const res = await fetch('/api/chat/preflight');
    const data = await res.json();
    
    if (data.providers && data.providers.length > 0) {
      const healthyProviders = data.providers.filter((p: ProviderResult) => p.healthy);
      
      providerRanking.results = data.providers;
      if (healthyProviders.length > 0) {
        providerRanking.primary = healthyProviders[0].name;
        providerRanking.fallback = healthyProviders.length > 1 ? healthyProviders[1].name : null;
      } else {
        providerRanking.primary = null;
        providerRanking.fallback = null;
      }

      console.log(
        '[LLM PREFLIGHT] Results:\n',
        data.providers.map((p: ProviderResult) => 
          `${p.name}: ${p.healthy ? `${p.latencyMs}ms ✅` : 'FAILED ❌'}${p.name === providerRanking.primary ? ' (PRIMARY)' : p.name === providerRanking.fallback ? ' (FALLBACK)' : ''}`
        ).join('\n')
      );
    }
    
    preflightCompleted = true;

    logInfo('preflight', 'Provider speed test completed', {
      providers: providerRanking.results.map(r => ({ name: r.name, healthy: r.healthy, latencyMs: r.latencyMs })),
      primary: providerRanking.primary,
      fallback: providerRanking.fallback,
    });

    return providerRanking;
  } catch (error) {
    console.error('[LLM PREFLIGHT] Preflight request failed:', error);
    // Keep defaults if preflight outright fails (e.g., network error before interview start)
    return providerRanking;
  }
}

/**
 * The fast path for calling the selected LLM.
 */
async function callProvider(
  provider: string,
  messages: { role: string; content: string }[],
  options: { temperature: number; maxTokens: number },
  timeoutMs: number
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`${provider} returned ${res.status}: ${err}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(`${provider} returned error: ${data.error}`);
    return data.response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Robust wrapper that tries the primary provider, and then single fallback if it fails.
 */
export async function callLLM(
  messages: { role: string; content: string }[],
  options: { temperature: number; maxTokens: number }
): Promise<string> {
  if (!providerRanking.primary) {
    // If we have literally no providers, throw so InterviewRoom can trigger emergency responses
    throw new Error('No healthy LLM providers available');
  }

  try {
    // FAST PATH: One provider call, standard timeout
    const start = Date.now();
    const response = await callProvider(providerRanking.primary, messages, options, 8000);
    logInfo('llm', 'LLM response received', {
      provider: providerRanking.primary,
      latency_ms: Date.now() - start,
    });
    return response;
  } catch (error) {
    console.warn(`[LLM] Primary (${providerRanking.primary}) failed mid-interview, switching to fallback. Error:`, error);
    logWarn('llm', 'Primary provider failed, using fallback', {
      failed_provider: providerRanking.primary,
      fallback_provider: providerRanking.fallback,
      error: error instanceof Error ? error.message : String(error),
    });
    
    if (providerRanking.fallback) {
      try {
        // Fallback attempt
        const response = await callProvider(providerRanking.fallback, messages, options, 8000);
        // Swap: fallback is reliable enough, make it the new primary
        console.log(`[LLM] Swap: ${providerRanking.fallback} is the new primary.`);
        providerRanking.primary = providerRanking.fallback;
        providerRanking.fallback = null; // We only support shifting down once before triggering ultimate failovers
        return response;
      } catch (fallbackError) {
        console.error('[LLM] Fallback also failed:', fallbackError);
        logError('llm', 'All LLM providers failed', {
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
        throw fallbackError; // Bubbles up to trigger emergency responses
      }
    }
    
    throw error; // No fallback available
  }
}

/**
 * Format the interview and hit the LLM. 
 * Replaces the old `getInterviewerResponse` entirely.
 */
export async function getInterviewerResponse(systemPrompt: string, transcript: TranscriptEntry[]): Promise<string> {
  // Format for the LLM
  const messages = [
    { role: 'system', content: systemPrompt },
  ];

  transcript.forEach((entry) => {
    messages.push({
      role: entry.role === 'ai' ? 'assistant' : 'user',
      content: entry.content
    });
  });

  return callLLM(messages, { temperature: 0.7, maxTokens: 150 });
}
