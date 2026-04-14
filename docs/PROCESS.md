# Process & Design Thinking — Cuemath AI Tutor Screener

> What I tried first. What broke. What I changed. And what I'd do differently.

---

## Starting Point

The initial goal was simple: build a voice-based AI interviewer at **$0 total cost**. That meant:
- **Web Speech API** for both STT and TTS (free, built into browsers)
- **Gemini Flash** for the LLM (Google's free tier)
- **Automatic silence detection** for turn-taking (no buttons needed)

This worked as a demo. A 2-minute test with a single user felt magical. Then real candidates used it.

---

## What Broke (and What I Learned)

### Problem 1: Web Speech API is Unreliable

The browser's built-in speech recognition randomly stops listening, restarts itself, and varies wildly between Chrome, Safari, and Firefox. During a 10-minute interview, it would silently die 2–3 times. The candidate kept talking. The transcript was empty.

**Decision:** Switch to **Deepgram Nova-3** (commercial-grade, `pre-recorded` endpoint). One API call, one `AudioBlob`, one result. No background restarts. The $200 free credit covers ~13,000 minutes of audio — thousands of interviews before any cost.

### Problem 2: Gemini's Free Tier Burned Through Credits

I was using the Google Cloud Console API, which has aggressive rate limits and burns through free credits unpredictably. Midway through testing, I hit the quota and the AI went silent.

**Decision:** Switch primary LLM to **Groq** (Llama 3.3 70B). Groq's free tier is genuinely free: 14,400 requests/day, no surprise charges. Keep Gemini as a fallback and for the assessment (which runs once per interview, not per exchange).

**Bonus:** Groq's LPU hardware responds in 200–400ms vs. Gemini's 800–1200ms. For a voice interview, that speed difference is the difference between "natural conversation" and "awkward silence."

### Problem 3: Auto-Silence Detection Was a Nightmare

Detecting when a candidate stops talking sounds simple. In practice: background noise triggers false positives, thoughtful pauses get interrupted, and every microphone has different sensitivity levels. The system would cut candidates off mid-sentence or wait forever during actual silence.

**Decision:** Switch to **push-to-talk**. The candidate holds a button while speaking and releases when done. It feels like a walkie-talkie, but it's infinitely more reliable than trying to interpret silence. No false triggers, no cut-offs, no ambiguity.

### Problem 4: The AI Sounded Like an AI

I tried making the AI feel "human": random 600ms thinking delays, filler words ("Mm-hmm," "I see") inserted 40% of the time, SSML emotion switching between questions. Instead of feeling human, it felt like a bad chatbot pretending to think. The delays felt fake, the fillers felt mechanical.

**Decision:** Delete all artificial humanness. Replace it with a **deeply specific persona prompt**. Nisha doesn't say "That's a great answer!" — she says "Oh the pizza thing, nice." She doesn't say "Could you elaborate?" — she says "Yeah? And then what?"

The prompt includes an explicit blocklist of phrases that reveal AI origin. Speed became the humanness: a 200ms response feels more professional than a fake 800ms "thinking" delay.

### Problem 5: The 15-Second Greeting Delay

The first exchange was always the slowest: the LLM needs to process the full system prompt, the TTS needs to synthesize a long greeting, and the candidate is staring at a blank screen.

**Decision:** **Pre-generate the greeting** during microphone setup. While the candidate is testing their mic, the server is already synthesizing Nisha's opening line and caching the audio. When the interview starts, the greeting plays instantly — zero wait.

### Problem 6: Candidates Getting Stuck

When a candidate said "I don't know" or "Can I skip?", the AI pushed harder: rephrasing the question, insisting on an answer, making them feel interrogated rather than interviewed.

**Decision:** A real interviewer says "No worries, let's move on." So does Nisha. The system prompt explicitly instructs: never force an answer, always respect skip requests. A candidate who says "I don't know" is showing self-awareness — the assessment should note this positively. Skipped questions are tracked in metadata and assessment confidence adjusts accordingly.

---

## What I'd Do Differently (Starting Over)

1. **Start with Deepgram + push-to-talk from day one.** I spent days debugging Web Speech API before accepting it was fundamentally unreliable for production use.

2. **Start with Groq instead of Gemini for conversation.** The speed difference is so significant that it changed the entire feel of the product.

3. **Build the assessment prompt iteratively with real transcripts.** The rubric evolved significantly once I saw actual candidate responses — theoretical prompt engineering only gets you 60% of the way there.

4. **Design the admin dashboard before the interview flow.** Understanding what data hiring managers need shaped which signals the interview should capture.

---

## What I'd Build With More Time

### Real-Time Streaming STT
Deepgram supports WebSocket streaming. This would show a live transcript as the candidate speaks (currently they only see the audio level visualization). Requires a persistent WebSocket proxy, which Vercel serverless doesn't support natively — would need a small dedicated server or Cloudflare Worker.

### Voice Cloning for Nisha
A consistent, unique voice (via ElevenLabs or Cartesia cloning) instead of a shared neural voice. Would make Nisha feel like a real person rather than a TTS engine.

### Multi-Language Support
Deepgram supports 30+ languages. Cuemath operates in India where candidates frequently mix Hindi and English. Code-switching detection — tracking when and why candidates switch languages — would be a genuine differentiator.

### A/B Testing Interview Questions
The Strategic Insights page already tracks which questions differentiate candidates best. The logical next step is automated question rotation to optimize for signal quality over time.

### Fine-Tuned Evaluation Model
Training a specialized model on human-scored interview transcripts to produce assessments that correlate more tightly with actual hiring outcomes. This closes the loop between AI evaluation and real-world tutor performance.

---

## Design Philosophy

> Every technical decision optimizes for one thing: giving candidates a **fair, comfortable, insightful** interview experience — and giving hiring managers the **data they need** to make confident decisions.

The system is not trying to trick, stress, or outperform candidates. It's trying to create the conditions where their genuine teaching instincts emerge naturally. A warm AI, a reliable mic, a forgiving interview flow, and an assessment engine that looks for strengths before weaknesses.
