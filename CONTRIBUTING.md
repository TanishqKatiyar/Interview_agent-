# Contributing to Cuemath AI Tutor Screener

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/TanishqKatiyar/cuemath-ai-screener.git
cd cuemath-ai-screener

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your API keys (see .env.example for details)

# Start the development server
npm run dev
```

---

## 📁 Project Structure

```
src/
├── app/          # Next.js App Router pages and API routes
├── components/   # React UI components
└── lib/          # Core business logic, utilities, and service integrations
```

### Key Modules

| Module | Purpose |
|---|---|
| `lib/llm.ts` | Multi-provider LLM router with pre-flight speed testing |
| `lib/gemini.ts` | Assessment rubric evaluation and coaching feedback |
| `lib/edge-tts-client.ts` | Edge TTS WebSocket client (reverse-engineered) |
| `lib/ssml.ts` | Dynamic SSML generation with prosody control |
| `lib/interview-engine.ts` | Interview phase progression and system prompts |
| `lib/scoring-engine.ts` | Composite hiring score calculation |
| `lib/speech-analytics.ts` | Candidate speech pattern analysis |
| `lib/integrity-analysis.ts` | Scripted-answer detection |
| `lib/rate-limiter.ts` | Per-IP sliding-window rate limiter |
| `lib/sanitize.ts` | Input sanitization (XSS, max-length, email) |

---

## 🛠 Development Workflow

### Running Locally

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build (type-check + bundle)
npm run lint     # ESLint check
```

### Code Style

- **TypeScript** — Strict mode enabled, no `any` where avoidable
- **Tailwind CSS** — Utility-first styling with the project's custom design tokens
- **Components** — Prefer composition, keep files focused (<400 lines)
- **API Routes** — Every route must have: rate limiting, input validation, generic error messages

### Commit Messages

Use conventional commits:

```
feat: add real-time streaming STT
fix: edge-tts reconnection on network drop
docs: update architecture diagram
refactor: extract LLM router into dedicated module
```

---

## 🧪 Testing Checklist

Before submitting changes, verify:

- [ ] `npm run build` passes with zero errors
- [ ] All API routes return generic error messages (no internal details leaked)
- [ ] New endpoints have rate limiting
- [ ] User inputs are sanitized
- [ ] The interview flow works end-to-end (mic setup → conversation → assessment)

---

## 📖 Architecture Reference

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a detailed walkthrough of every system component.

---

## 📝 License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
