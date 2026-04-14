# Database Schema — Cuemath AI Tutor Screener

> Supabase (PostgreSQL) schema reference. All tables live in the `public` schema.

---

## Tables

### `interviews`

The core table. Each row represents one candidate interview session.

```sql
CREATE TABLE interviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Candidate info
  candidate_name    TEXT NOT NULL,
  candidate_email   TEXT,
  
  -- Interview lifecycle
  status            TEXT NOT NULL DEFAULT 'pending',
  -- Values: 'pending' | 'in_progress' | 'completed' | 'assessed'
  
  token             TEXT UNIQUE NOT NULL,
  -- crypto.randomUUID() — used in interview URL
  
  -- Conversation data
  transcript        JSONB DEFAULT '[]',
  -- Array of { role, content, timestamp, phase }
  
  metadata          JSONB,
  -- Interview metadata: phases completed, duration, provider used, etc.
  
  -- Timing
  duration_seconds  INTEGER,
  created_at        TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  
  -- Assessment (populated after /api/assess)
  assessment        JSONB,
  -- Full rubric: dimensions, scores, evidence, red_flags, strengths, etc.
  
  overall_score     REAL,
  -- Weighted average of dimension scores (1.0 – 5.0)
  
  recommendation    TEXT,
  -- 'strong_pass' | 'pass' | 'borderline' | 'fail'
  
  -- Deep Intelligence layers (populated after assessment)
  speech_analytics  JSONB,
  -- Response latency, hedging frequency, analogy usage, vocab richness
  
  integrity_report  JSONB,
  -- Scripted-answer detection, engagement consistency, confidence flags
  
  interview_quality JSONB,
  -- Self-evaluation: question effectiveness, difficulty calibration
  
  hiring_score      JSONB,
  -- Composite 0–100 score with component breakdown and percentile rank
  
  coaching_feedback JSONB DEFAULT '[]',
  -- Array of actionable tips for the candidate
  
  -- Invitation tracking
  invitation_sent   BOOLEAN DEFAULT false,
  invitation_sent_at TIMESTAMPTZ
);

-- Performance indexes
CREATE INDEX idx_interviews_status ON interviews(status);
CREATE INDEX idx_interviews_token ON interviews(token);
CREATE INDEX idx_interviews_created_at ON interviews(created_at DESC);
CREATE INDEX idx_interviews_overall_score ON interviews(overall_score DESC);
```

### `logs`

Structured telemetry for system monitoring. 30-day retention.

```sql
CREATE TABLE logs (
  id          BIGSERIAL PRIMARY KEY,
  
  timestamp   TIMESTAMPTZ DEFAULT now(),
  level       TEXT NOT NULL,       -- 'info' | 'warn' | 'error'
  category    TEXT NOT NULL,       -- 'api' | 'llm' | 'tts' | 'stt' | 'auth'
  message     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',  -- Structured context (latency_ms, interview_id, etc.)
  
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Query optimization
CREATE INDEX idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX idx_logs_category ON logs(category);
CREATE INDEX idx_logs_level ON logs(level);

-- Auto-cleanup: delete logs older than 30 days
-- (Run via Supabase cron or pg_cron extension)
-- DELETE FROM logs WHERE timestamp < now() - interval '30 days';
```

---

## Transcript Entry Format

Each entry in the `transcript` JSONB array:

```json
{
  "role": "interviewer",
  "content": "Tell me about a time you had to explain a difficult concept to a young student.",
  "timestamp": "2026-04-18T10:23:45.123Z",
  "phase": 2
}
```

| Field | Type | Description |
|---|---|---|
| `role` | `"interviewer"` or `"candidate"` | Who spoke |
| `content` | string | What was said (transcribed text) |
| `timestamp` | ISO 8601 | When the utterance occurred |
| `phase` | number (1–5) | Interview phase at time of utterance |

---

## Assessment Structure

The `assessment` JSONB column contains:

```json
{
  "dimensions": {
    "communication_clarity": { "score": 4.2, "evidence": "..." },
    "warmth_and_rapport": { "score": 3.8, "evidence": "..." },
    "simplification_ability": { "score": 4.5, "evidence": "..." },
    "patience_indicators": { "score": 4.0, "evidence": "..." },
    "english_fluency": { "score": 3.5, "evidence": "..." }
  },
  "overall_score": 4.1,
  "recommendation": "pass",
  "confidence": "high",
  "strengths": ["Uses relatable analogies", "Calm and patient tone"],
  "areas_for_improvement": ["Could ask more probing follow-up questions"],
  "red_flags": [],
  "summary": "Strong candidate with excellent pedagogical instincts..."
}
```

---

## Setup Instructions

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Navigate to the **SQL Editor**
3. Run the `CREATE TABLE` statements above
4. Copy your project URL and keys to `.env.local`

No Row Level Security (RLS) is required for the showcase deployment — all database access goes through server-side API routes with the service role key.
