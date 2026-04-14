import { chatLimiter } from '@/lib/rate-limiter';

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { allowed, retryAfterMs } = chatLimiter.check(ip, 3, 60 * 1000);
  
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  const results = await Promise.allSettled([
    testGroq(),
    testGemini(),
    testOpenRouter(),
  ]);

  const providers = [
    { name: 'groq', result: results[0] },
    { name: 'gemini', result: results[1] },
    { name: 'openrouter', result: results[2] },
  ].map(({ name, result }) => ({
    name,
    healthy: result.status === 'fulfilled',
    latencyMs: result.status === 'fulfilled' ? (result.value as any).latencyMs : Infinity,
  }))
  .sort((a, b) => a.latencyMs - b.latencyMs);

  return Response.json({ providers });
}

async function testGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('No API key');

  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Reply with only the word OK' },
          { role: 'user', content: 'test' }
        ],
        max_tokens: 5,
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Groq error ${res.status}`);
    await res.json();
    return { latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('No API key');

  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'Reply with only the word OK' }] },
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        generationConfig: { maxOutputTokens: 5 }
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Gemini error ${res.status}`);
    await res.json();
    return { latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function testOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('No API key');

  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://cuemath.com',
        'X-Title': 'Cuemath AI Screener',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [
          { role: 'system', content: 'Reply with only the word OK' },
          { role: 'user', content: 'test' }
        ],
        max_tokens: 5,
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
    await res.json();
    return { latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timeoutId);
  }
}
