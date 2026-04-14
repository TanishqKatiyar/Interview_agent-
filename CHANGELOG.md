# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.0.0] — 2026-04-18

### 🎉 Initial Release

#### Voice Pipeline
- Real-time speech-to-text via Deepgram Nova-3 with mathematical term accuracy
- Neural text-to-speech via Edge TTS with SSML prosody control (warm, curious, gentle tones)
- Push-to-talk microphone interface with real-time audio waveform visualization
- Server-side TTS cache (150 entries) for sub-5ms common phrase delivery

#### AI Interview Engine
- Multi-provider LLM routing: Groq (primary) → Gemini → OpenRouter → Emergency responses
- Pre-flight speed testing during mic setup — locks in fastest provider per session
- 5-phase interview structure: Warm-up → Teaching Scenario → Patience Probe → Adaptability → Wrap-up
- "Nisha" interviewer persona with anti-AI-phrase rules for natural conversation

#### Assessment Engine
- 5-dimension rubric scoring: Communication, Warmth, Simplification, Patience, Fluency
- Server-side score validation — independently recalculates and overrides LLM if math disagrees
- Speech analytics: response latency, hedging frequency, analogy usage, vocabulary richness
- Integrity analysis: scripted-answer detection, engagement consistency monitoring
- Interview quality self-evaluation: question effectiveness and difficulty calibration
- Composite hiring score (0–100) with percentile ranking against historical pool
- Auto-generated coaching feedback for candidates

#### Admin Dashboard
- Real-time interview list with auto-refresh and status badges
- Deep-dive candidate pages: full transcript, rubric breakdown, analytics, coaching tips
- Side-by-side candidate comparison with AI-generated analysis
- Aggregate hiring analytics and strategic insights
- System monitoring: API health, latency distributions (P50/P95/P99), error rates
- Email invitations via Resend with unique interview tokens
- Bulk CSV upload for batch candidate invitations

#### Security
- Server-side-only API keys (zero client exposure)
- Per-IP sliding-window rate limiting on every public endpoint
- Input sanitization: XSS prevention, max-length enforcement, email validation
- Admin auth: httpOnly cookies, timing-safe comparison, brute-force protection
- Security headers: HSTS, X-Frame-Options DENY, CSP, nosniff
- Generic error messages — internal details logged but never sent to clients

#### Resilience
- Graceful degradation on LLM/TTS/STT failure: automatic fallback chains
- `navigator.sendBeacon` saves interview state on tab close — no data loss
- Network reconnection handling with state preservation
- Emergency pre-written questions for total API failure scenarios
- 15-minute hard timeout with natural interview conclusion
