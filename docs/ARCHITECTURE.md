# Architecture — Cuemath AI Tutor Screener

> A component-by-component walkthrough of how the system is built, why each decision was made, and how the pieces connect.

---

## Table of Contents

- [System Overview](#system-overview)
- [Voice Pipeline](#1-voice-pipeline)
- [LLM Routing Engine](#2-llm-routing-engine)
- [Interview State Machine](#3-interview-state-machine)
- [Assessment Engine](#4-assessment-engine)
- [Admin Intelligence Layer](#5-admin-intelligence-layer)
- [Security Architecture](#6-security-architecture)

---

## System Overview

The system is a **three-tier architecture**: browser client, Next.js API layer, and Supabase persistence. All AI inference happens server-side via API routes — the browser never touches an API key.

```
Browser (React)              Server (Next.js)              External Services
┌──────────────┐       ┌─────────────────────┐       ┌────────────────────┐
│ InterviewRoom │──────►│ /api/chat           │──────►│ Groq (Llama 3.3)   │
│              │       │   └─ LLM Router      │   ┌──►│ Google AI (Gemini) │
│ AudioVisualizer│     │      ├─ Primary pick  │───┘  │ OpenRouter (misc)  │
│              │       │      └─ Fallback chain│      └────────────────────┘
│ MicSetup     │───────│ /api/stt             │──────►│ Deepgram Nova-3    │
│              │       │   └─ Pre-recorded API │      └────────────────────┘
│ TTS Playback │◄──────│ /api/tts             │──────►│ Edge TTS (WSS)     │
│              │       │   └─ SSML generator   │      └────────────────────┘
│              │       │   └─ 150-entry cache  │
└──────┬───────┘       │ /api/assess           │
       │               │   ├─ Rubric evaluator  │──────►│ Gemini 2.0 Flash  │
       │               │   ├─ Speech analytics  │      │ (structured JSON) │
       │               │   ├─ Integrity checker │──────►│ Groq (Llama 3.3)  │
       │               │   └─ Quality monitor   │      └────────────────────┘
       │               └──────────┬──────────────┘
       │                          │
       │               ┌──────────▼──────────────┐
       └──────────────►│ Supabase PostgreSQL      │
                       │  ├─ interviews table      │
                       │  └─ logs table (30d TTL)  │
                       └───────────────────────────┘
```

---

## 1. Voice Pipeline

### Speech-to-Text (STT)

**File:** `src/app/api/stt/route.ts`

The browser captures audio via `MediaRecorder`, encodes it as a WebM/Opus blob, and POSTs it to `/api/stt`. Server-side, the Deepgram SDK's `pre-recorded` endpoint transcribes it with the `nova-3` model.

**Why Deepgram over Web Speech API?**
- Web Speech API is browser-dependent, drops connection randomly, and provides no confidence scores.
- Deepgram Nova-3 handles mathematical terms ("one-half", "two-thirds") accurately and returns timestamps + confidence.
- The `$200 free credit` covers thousands of interviews.

**Fallback:** If Deepgram fails 3 times in a session, a text input appears: "Type your answer instead."

### Text-to-Speech (TTS)

**Files:** `src/app/api/tts/route.ts`, `src/lib/edge-tts-client.ts`, `src/lib/ssml.ts`

The Edge TTS client reverse-engineers Microsoft's Edge browser TTS WebSocket endpoint to get free, unlimited, neural voice synthesis. The SSML generator dynamically wraps each response with prosody controls:

```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis">
  <voice name="en-US-JennyNeural">
    <prosody rate="-5%" pitch="+2%">
      Oh, the pizza thing — nice!
    </prosody>
  </voice>
</speak>
```

**Server-side cache:** An LRU cache (150 entries) stores pre-synthesized audio. Common phrases ("Tell me more", "That's interesting") are served from cache in <5ms instead of re-synthesizing every time.

**Fallback:** If Edge TTS fails → Web Speech API → Display text on screen.

### Audio Visualization

**File:** `src/components/AudioVisualizer.tsx`

A real-time waveform rendered via the Web Audio API's `AnalyserNode`. The visualization uses `requestAnimationFrame` for smooth 60fps rendering and respects `prefers-reduced-motion`.

---

## 2. LLM Routing Engine

**Files:** `src/lib/llm.ts`, `src/app/api/chat/preflight/route.ts`

### Pre-Flight Speed Test

During microphone setup, the `/api/chat/preflight` route simultaneously pings:
1. **Groq** (Llama 3.3 70B) — typically 150–300ms
2. **Gemini 2.0 Flash** — typically 400–600ms
3. **OpenRouter** — typically 500–900ms

The fastest healthy provider is locked in as the primary for the entire interview session.

### Runtime Fallback Chain

If the primary fails during the interview:

```
Primary (Groq) ──FAIL──► Gemini ──FAIL──► OpenRouter ──FAIL──► Emergency Responses
                                                                      │
                                                          Pre-written, phase-aware
                                                          questions stored in
                                                          emergency-responses.ts
```

The candidate never sees a loading spinner longer than 2 seconds. The emergency responses are specific to each interview phase, so even in total API failure, the interview produces usable transcript data.

---

## 3. Interview State Machine

**Files:** `src/lib/interview-engine.ts`, `src/components/InterviewRoom.tsx`

The interview progresses through a deterministic state machine:

```
┌──────┐    mic ready    ┌──────────┐   5 phases done   ┌───────────┐
│ SETUP ├───────────────►│ INTERVIEW ├──────────────────►│ COMPLETED  │
└──────┘                 └─────┬─────┘                   └─────┬──────┘
                               │                               │
                          Each exchange:                   Auto-triggers:
                          1. Record audio                 /api/assess
                          2. Transcribe (STT)
                          3. Add to transcript
                          4. Get AI response (LLM)
                          5. Speak response (TTS)
                          6. Check phase progression
```

**Phase progression** is driven by the LLM itself — the system prompt instructs Nisha to naturally transition between topics over 5 phases. Metadata tracks which phase each exchange belongs to.

**`navigator.sendBeacon`:** If the candidate closes the tab, the `beforeunload` handler fires a beacon to `/api/interviews/finalize`, saving the transcript and triggering assessment if enough data exists. No interview data is ever lost.

---

## 4. Assessment Engine

**File:** `src/app/api/interviews/assess/route.ts`

Assessment runs as a **multi-layer pipeline** — six independent analyzers produce a comprehensive evaluation:

### Layer 1: Rubric Evaluation (Gemini)
Gemini 2.0 Flash evaluates the transcript against a structured rubric, returning JSON with scores (1–5) and qualitative evidence for each dimension:
- Communication Clarity (25%)
- Warmth & Rapport (20%)
- Simplification Ability (25%)
- Patience Indicators (20%)
- English Fluency (10%)

**Score validation:** The server independently recalculates the weighted overall score and overrides Gemini if the math doesn't match. Recommendations are derived from rules (not LLM judgment):
- `strong_pass`: overall ≥ 4.0 and no dimension below 3.5
- `pass`: overall ≥ 3.5 and no dimension below 2.5
- `borderline`: doesn't qualify for pass or fail
- `fail`: 2+ dimensions below 2.5, or overall < 3.0, or red flags present

### Layer 2: Speech Analytics (Pure Computation)
**File:** `src/lib/speech-analytics.ts`

Zero-LLM analysis of candidate speaking patterns:
- Average response latency (time between question and answer)
- Hedging frequency ("um", "kind of", "I think maybe")
- Analogy usage ("it's like...", "think of it as...")
- Vocabulary richness (unique word ratio)
- Response length consistency

### Layer 3: Integrity Analysis (Groq)
**File:** `src/lib/integrity-analysis.ts`

Groq analyzes whether candidate answers seem scripted, rehearsed, or suspiciously perfect. Flags: sudden engagement drops, copy-paste-style responses, dramatically different speaking styles between questions.

### Layer 4: Interview Quality (Self-Monitoring)
**File:** `src/lib/interview-quality.ts`

The system evaluates **its own performance**: Were the AI's questions effective? Was the difficulty level appropriate? This creates a feedback loop for improving question design.

### Layer 5: Coaching Feedback (Gemini)
Gemini generates actionable, encouraging improvement tips for the candidate: "Your patience was excellent. Try using more concrete examples when explaining abstract concepts."

### Layer 6: Composite Hiring Score
**File:** `src/lib/scoring-engine.ts`

A single 0–100 metric that dynamically weighs all signals: rubric scores, speech analytics, integrity confidence, and interview difficulty — normalized against the historical candidate pool.

---

## 5. Admin Intelligence Layer

### Dashboard (`/admin`)
Auto-refreshing list of all interviews with status badges, scores, and quick-action buttons.

### Deep Dive (`/admin/[id]`)
Full transcript, rubric breakdown, speech analytics charts, integrity report, and coaching tips — all on one page.

### Compare Mode (`/admin/compare`)
Select two candidates for side-by-side analysis. An LLM generates a structured comparison summary highlighting relative strengths.

### Strategic Insights (`/admin/insights`)
AI-generated aggregate analysis: which questions differentiate candidates best, common failure patterns, team composition recommendations.

### System Monitoring (`/admin/monitoring`)
Real-time API health, latency distributions (P50/P95/P99), error rates, and request volume — powered by the structured `logs` table.

---

## 6. Security Architecture

### Defense in Depth

```
Request ──► Rate Limiter ──► Input Sanitizer ──► Auth Check ──► Handler
               │                   │                  │
          Per-IP sliding       Strip HTML/XSS      httpOnly cookie
          window limiter       Max length enforce   timing-safe compare
               │                   │                  │
          429 if exceeded      400 if invalid       401 if unauthorized
```

### Key Principles

1. **Zero client-side secrets** — All API keys are server-only environment variables.
2. **Rate limiting everywhere** — Every public endpoint has per-IP sliding-window rate limiting.
3. **Input sanitization** — All user-provided text is sanitized via dedicated `sanitize.ts` utilities.
4. **Generic error messages** — Internal errors are logged server-side but never exposed to clients.
5. **Security headers** — HSTS, X-Frame-Options DENY, CSP, nosniff on every response.
6. **Cryptographic tokens** — Interview access tokens use `crypto.randomUUID()` with 7-day expiry.
