// ─── Interview Flow Phases ───────────────────────────────────────────────────

export type InterviewPhase =
  | 'GREETING'
  | 'WARM_UP'
  | 'CORE_ASSESSMENT'
  | 'SCENARIO'
  | 'WRAP_UP'
  | 'ENDED';

// ─── Transcript ──────────────────────────────────────────────────────────────

export interface TranscriptEntry {
  /** Who said this line */
  role: 'ai' | 'candidate';
  /** The spoken text */
  content: string;
  /** Seconds elapsed since interview start */
  timestamp: number;
  /** Which phase the interview was in when this was said */
  phase: InterviewPhase;
}

// ─── Speech-to-Text Result ──────────────────────────────────────────────────

export type STTSource = 'web_speech' | 'whisper';
export type STTMode = 'web_speech' | 'whisper' | 'hybrid';

export interface SpeechResult {
  /** The transcribed text */
  transcript: string;
  /** Confidence score (0–1). Web Speech API provides this; Whisper ≈ 0.95. */
  confidence: number;
  /** Alternative transcriptions (Web Speech only, up to maxAlternatives) */
  alternatives: string[];
  /** Which STT engine produced this result */
  source: STTSource;
  /** Whether the result is final or interim */
  isFinal: boolean;
  /** If true, this is mostly filler words (um, uh, hmm) */
  isFillerOnly: boolean;
}

// ─── Interview Metadata ─────────────────────────────────────────────────────

export type AdaptiveDifficulty = 'standard' | 'elevated' | 'simplified';

export interface InterviewMetadata {
  /** Total wall-clock duration of the interview in seconds */
  totalDuration: number;
  /** Cumulative seconds the candidate was speaking */
  candidateSpeakingTime: number;
  /** Cumulative seconds the AI was speaking */
  aiSpeakingTime: number;
  /** Number of prolonged silence events (>5 s) detected */
  silenceEvents: number;
  /** Number of candidate responses shorter than ~10 words */
  shortAnswerCount: number;
  /** All questions the AI asked, in order */
  questionsAsked: string[];
  /** How many times the AI had to probe deeper with a follow-up */
  followUpsNeeded: number;
  /** Start / end timestamps for every phase */
  phaseTimings: Record<InterviewPhase, { start: number; end: number | null }>;
  /** Adaptive difficulty level set mid-interview based on candidate performance */
  adaptiveDifficulty?: AdaptiveDifficulty;
}

// ─── Assessment Scoring ─────────────────────────────────────────────────────

export interface DimensionScore {
  /** 1–5 in 0.5 increments */
  score: number;
  /** Verbatim quotes / observations backing the score */
  evidence: string[];
  /** Short paragraph explaining why this score was given */
  reasoning: string;
}

export interface AssessmentDimensions {
  communication_clarity: DimensionScore;
  warmth_and_rapport: DimensionScore;
  simplification_ability: DimensionScore;
  patience_indicators: DimensionScore;
  english_fluency: DimensionScore;
}

export type Recommendation = 'strong_pass' | 'pass' | 'borderline' | 'fail';
export type Confidence = 'high' | 'medium' | 'low';

// ─── Teaching Persona (Feature 2) ───────────────────────────────────────────

export type TeachingPersonaType =
  | 'patient_guide'
  | 'enthusiastic_explainer'
  | 'structured_coach'
  | 'empathetic_mentor'
  | 'adaptive_solver';

export interface TeachingPersona {
  type: TeachingPersonaType;
  label: string;
  description: string;
  best_for: string;
}

// ─── Coaching Feedback (Feature 1) ──────────────────────────────────────────

export interface CoachingTip {
  type: 'strength' | 'tip';
  text: string;
}

// ─── Deep Intelligence (Feature 6, 7, 8) ────────────────────────────────────

export interface SpeechAnalytics {
  avgResponseTime: number;
  avgResponseLength: number;
  responseConsistency: number;
  vocabularyDiversity: number;
  avgSentenceLength: number;
  complexSentenceRatio: number;
  questionUsage: number;
  analogyCount: number;
  stepByStepCount: number;
  concreteExampleCount: number;
  hedgingFrequency: number;
  assertivenessScore: number;
  selfCorrectionCount: number;
  elaborationTrend: 'increasing' | 'decreasing' | 'stable';
  engagementScore: number;
}

export type IntegrityFlagType = 'scripted_answers' | 'response_delay_anomaly' | 'vocabulary_mismatch' | 'consistency_concern' | 'engagement_drop';

export interface IntegrityFlag {
  type: IntegrityFlagType;
  severity: 'low' | 'medium' | 'high';
  evidence: string;
  explanation: string;
}

export interface IntegrityReport {
  overallConfidence: 'high' | 'medium' | 'low';
  flags: IntegrityFlag[];
  summary: string;
}

export interface InterviewQuality {
  overallQuality: number;
  signalStrength: 'strong' | 'adequate' | 'weak';
  factors: {
    coverageScore: number;
    depthScore: number;
    candidateComfort: number;
    balanceRatio: number;
    questionsAsked: number;
    followUpsAsked: number;
    scenarioCompleted: boolean;
  };
  recommendations: string[];
  assessmentReliability: 'high' | 'medium' | 'low';
}


export interface Assessment {
  dimensions: AssessmentDimensions;
  /** Weighted composite score (1–5) */
  overall_score: number;
  recommendation: Recommendation;
  /** Deal-breaker observations */
  red_flags: string[];
  /** Top strengths worth highlighting */
  strengths: string[];
  /** Actionable improvement areas */
  areas_for_improvement: string[];
  /** 2–3 sentence human-readable summary */
  summary: string;
  /** How confident the AI is in this assessment */
  confidence: Confidence;
  /** Teaching persona classification */
  teaching_persona?: TeachingPersona;
}

// ─── Interview Status ───────────────────────────────────────────────────────

export type InterviewStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'assessed';

// ─── Core Interview Entity ──────────────────────────────────────────────────

export interface HiringScore {
  composite: number;
  confidence: number;
  range: {
    low: number;
    high: number;
  };
  breakdown: {
    baseScore: number;
    completionMultiplier: number;
    signalBonus: number;
    integrityPenalty: number;
    adaptiveDifficultyBonus: number;
  };
  percentile: string;
  recommendation: 'strong_hire' | 'hire' | 'maybe' | 'pass';
}

export interface Interview {
  id: string;
  candidate_name: string;
  candidate_email: string;
  status: InterviewStatus;
  /** Unique shareable token used in the interview URL */
  interview_token: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  transcript: TranscriptEntry[] | null;
  audio_url: string | null;
  assessment: Assessment | null;
  overall_score: number | null;
  recommendation: string | null;
  metadata: InterviewMetadata | null;
  /** Post-interview coaching tips for the candidate */
  coaching_feedback: CoachingTip[] | null;
  speech_analytics: SpeechAnalytics | null;
  integrity_report: IntegrityReport | null;
  interview_quality: InterviewQuality | null;
  hiring_score: HiringScore | null;
  created_at: string;
}

// ─── Interview Questions ────────────────────────────────────────────────────

export type QuestionCategory =
  | 'explanation_ability'
  | 'patience_empathy'
  | 'adaptability'
  | 'diagnostic_instinct'
  | 'parent_communication'
  | 'classroom_engagement';

export interface InterviewQuestion {
  id: string;
  category: QuestionCategory;
  /** The main question text */
  text: string;
  /** Context-dependent follow-ups the AI can use */
  followUps: {
    /** If the candidate gives a vague or unfocused answer */
    ifVague: string;
    /** If the candidate gives a very short answer */
    ifShort: string;
    /** If the candidate gives a solid answer — dig deeper */
    ifGood: string;
  };
}
