import { GoogleGenerativeAI } from '@google/generative-ai';
import { chatLimiter } from '@/lib/rate-limiter';
import { sanitizeText } from '@/lib/sanitize';

// ============================================================================
// Environment Variables
// GROQ_API_KEY — primary LLM + Whisper (console.groq.com, free)
// GEMINI_API_KEY — fallback LLM (aistudio.google.com/apikey, free)
// OPENROUTER_API_KEY — last resort LLM (openrouter.ai, free)
// All server-side only. NEVER prefix with NEXT_PUBLIC_.
// ============================================================================

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const { allowed, retryAfterMs } = chatLimiter.check(ip, 30, 60 * 1000);
  
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  try {
    const { provider, messages, temperature, maxTokens } = await request.json();

    const sanitizedMessages = messages.map((m: any) => ({
      role: m.role,
      content: sanitizeText(m.content, 5000),
    }));

    let response: string;

    switch (provider) {
      case 'groq':
        response = await callGroqServer(sanitizedMessages, temperature, maxTokens);
        break;
      case 'gemini':
        response = await callGeminiServer(sanitizedMessages, temperature, maxTokens);
        break;
      case 'openrouter':
        response = await callOpenRouterServer(sanitizedMessages, temperature, maxTokens);
        break;
      default:
        return Response.json({ error: 'Unknown provider' }, { status: 400 });
    }

    return Response.json({ response, provider });
  } catch (error: any) {
    console.error(`[LLM Server] Error:`, error.message);
    return Response.json({ error: 'LLM request failed' }, { status: 500 });
  }
}

async function callGroqServer(messages: any[], temperature: number, maxTokens: number): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature,
      max_tokens: maxTokens,
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGeminiServer(messages: any[], temperature: number, maxTokens: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const genAI = new GoogleGenerativeAI(apiKey);
  // Separate system message if exists
  let systemInstruction: string | undefined = undefined;
  const geminiHistory: any[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = msg.content;
    } else {
      geminiHistory.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
  }

  // Use the proper SDK structure for system instructions (since v0.1.1)
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash',
    systemInstruction: systemInstruction,
  });

  const result = await model.generateContent({
    contents: geminiHistory,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: temperature,
    }
  });

  return result.response.text();
}

async function callOpenRouterServer(messages: any[], temperature: number, maxTokens: number): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://cuemath.com', // Replace with actual domain
      'X-Title': 'Cuemath AI Screener',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      messages,
      temperature,
      max_tokens: maxTokens,
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
