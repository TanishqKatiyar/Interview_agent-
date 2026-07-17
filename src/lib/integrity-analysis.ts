import type { TranscriptEntry, InterviewMetadata, SpeechAnalytics, IntegrityReport, IntegrityFlag } from './types';
import { getGroq, getGenAI } from './gemini';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GEMINI_MODEL = 'gemini-2.0-flash';

const CONSISTENCY_PROMPT = `Analyze the following interview responses from a single candidate. 
Look exclusively for FACTUAL CONTRADICTIONS in their background, experience, or claims.
If they say "I have taught for 3 years" and later say "I have no experience", that is a contradiction.

Transcript:
{transcript}

If you find a clear contradiction, respond ONLY with a short description of the contradiction (max 2 sentences).
If you find NO contradictions, respond exactly with "NONE".`;

export async function analyzeIntegrity(
  transcript: TranscriptEntry[],
  metadata: InterviewMetadata,
  speechAnalytics: SpeechAnalytics
): Promise<IntegrityReport> {
  const flags: IntegrityFlag[] = [];
  const candidateEntries = transcript.filter((t) => t.role === 'candidate');

  if (candidateEntries.length < 3) {
    return {
      overallConfidence: 'low',
      flags: [],
      summary: "Interview too short to perform reliable integrity analysis."
    };
  }

  // A. SCRIPTED ANSWER DETECTION
  if (speechAnalytics.vocabularyDiversity > 0.85 && speechAnalytics.hedgingFrequency < 1.0) {
    flags.push({
      type: 'scripted_answers',
      severity: 'high',
      evidence: `Vocabulary diversity: ${speechAnalytics.vocabularyDiversity.toFixed(2)}, Hedging/Fillers: ${speechAnalytics.hedgingFrequency.toFixed(1)}/100 words`,
      explanation: "The candidate's vocabulary is extremely dense and varied with almost zero conversational filler words. This is statistically improbable in spontaneous speech and strongly suggests the candidate was reading prepared answers or AI-generated text."
    });
  } else if (speechAnalytics.avgSentenceLength > 25) {
    flags.push({
      type: 'scripted_answers',
      severity: 'medium',
      evidence: `Avg sentence length: ${speechAnalytics.avgSentenceLength} words`,
      explanation: "Sentences are unusually long for spoken dialogue, closer to written essays. This may indicate reading from a screen."
    });
  }

  // B. RESPONSE DELAY ANOMALY
  const responseTimes: number[] = [];
  for (let i = 1; i < transcript.length; i++) {
    if (transcript[i].role === 'candidate' && transcript[i - 1].role === 'ai') {
      responseTimes.push(Math.max(0, transcript[i].timestamp - transcript[i - 1].timestamp));
    }
  }
  
  if (responseTimes.length >= 2) {
    const minDelay = Math.min(...responseTimes);
    const maxDelay = Math.max(...responseTimes);
    // If they answer instantly sometimes, but take huge pauses others
    if (minDelay < 3 && maxDelay > 15) {
      flags.push({
        type: 'response_delay_anomaly',
        severity: 'medium',
        evidence: `Delays range from ${minDelay}s to ${maxDelay}s`,
        explanation: "The candidate's response time is highly erratic. Answering some questions instantly while taking massive pauses for others could indicate looking up answers during the pause."
      });
    }
  }

  // C. ENGAGEMENT DROP
  if (speechAnalytics.elaborationTrend === 'decreasing') {
    flags.push({
      type: 'engagement_drop',
      severity: 'low',
      evidence: "Response length dropped significantly in the second half of the interview.",
      explanation: "The candidate gave progressively shorter answers. This could just be fatigue, or it could mean they ran out of prepared material."
    });
  }

  // D. CONSISTENCY CONCERN (LLM check)
  const candidateText = candidateEntries.map((e, i) => `Answer ${i + 1}: ${e.content}`).join('\n\n');
  const prompt = CONSISTENCY_PROMPT.replace('{transcript}', candidateText);
  
  let consistencyIssue = '';
  try {
    const groq = getGroq();
    if (groq) {
      const result = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 150,
      });
      consistencyIssue = result.choices[0]?.message?.content?.trim() || '';
    } else {
      const genAI = getGenAI();
      if (genAI) {
         const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          generationConfig: { temperature: 0.1, maxOutputTokens: 150 },
        });
        const result = await model.generateContent(prompt);
        consistencyIssue = result.response.text().trim();
      }
    }

    if (consistencyIssue && !consistencyIssue.includes('NONE') && consistencyIssue.length > 10) {
      flags.push({
        type: 'consistency_concern',
        severity: 'high',
        evidence: consistencyIssue,
        explanation: "The AI detected a factual contradiction across the candidate's answers regarding their background or experience."
      });
    }
  } catch (err) {
    console.error("[Integrity] LLM Consistency check failed:", err);
  }

  // Determine overall confidence
  let overallConfidence: 'high' | 'medium' | 'low' = 'high';
  const highFlags = flags.filter(f => f.severity === 'high').length;
  const medFlags = flags.filter(f => f.severity === 'medium').length;

  if (highFlags > 0) overallConfidence = 'low';
  else if (medFlags > 0) overallConfidence = 'medium';

  return {
    overallConfidence,
    flags,
    summary: flags.length === 0 
      ? "No significant integrity concerns detected." 
      : `${flags.length} potential behavioral anomalies flagged.`
  };
}
