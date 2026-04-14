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
  return data.choices[0].message.content;
}

async function callGeminiServer(messages: any[], temperature: number, maxTokens: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

  // Use raw fetch if we need to pass system instructions differently,
  // but generative-ai SDK supports it in newer versions. For safety and 
  // maximum compatibility with older SDK versions we can just prepend it 
  // to the first user message if systemInstruction isn't natively supported 
  // in the generateContent args, OR we just trust the SDK. 
  // Let's use the REST API directly to be safe and perfectly match the OpenAI-like flow, 
  // actually the user specifically told us:
  // "SDK: @google/generative-ai, model: gemini-2.0-flash, Convert message format... Extract system message"
  
  if (systemInstruction) {
    // Attempting standard SDK format for gemini-1.5+ which requires systemInstruction at model init
    // Or we simply inject it into the first user prompt if the SDK doesn't support the property.
    // The safest fallback is injecting it into the history if system setup fails, but we'll try standard.
    if (geminiHistory.length > 0 && geminiHistory[0].role === 'user') {
      geminiHistory[0].parts[0].text = `System Instructions: ${systemInstruction}\n\n${geminiHistory[0].parts[0].text}`;
    } else {
      geminiHistory.unshift({ role: 'user', parts: [{ text: `System Instructions: ${systemInstruction}` }] });
      geminiHistory.push({ role: 'model', parts: [{ text: `Acknowledged.` }] });
    }
  }

  // The last message in history is the prompt we send, the rest is "contents" (history).
  // generative-ai requires startChat for history, or generateContent with array of contents.
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
  return data.choices[0].message.content;
}
