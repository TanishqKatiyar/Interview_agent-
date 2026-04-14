import type { Interview, HiringScore } from './types';

export function calculateHiringScore(
  interview: Interview,
  allHistoricalInterviews: Interview[]
): HiringScore | null {
  
  if (!interview.assessment || !interview.metadata || !interview.interview_quality || !interview.integrity_report) {
    return null;
  }

  // 1. BASE SCORE
  const baseScore = Math.max(0, Math.min(100, interview.assessment.overall_score * 20));

  // 2. COMPLETION MULTIPLIER
  const totalAsked = interview.metadata.questionsAsked?.length || 0;
  const questionsAnswered = interview.transcript ? new Set(interview.transcript.filter(t => t.role === 'ai').map(t => t.content)).size : 0;
  const questionRatio = totalAsked > 0 ? Math.min(1, questionsAnswered / totalAsked) : 0;
  
  const durationScore = Math.min(interview.duration_seconds || 0, 600) / 600;
  const completionMultiplier = (questionRatio * 0.5) + (durationScore * 0.5);

  // 3. SIGNAL BONUS
  const signalBonus = interview.interview_quality.overallQuality * 0.05;

  // 4. INTEGRITY PENALTY
  const highFlags = interview.integrity_report.flags.filter(f => f.severity === 'high').length;
  const medFlags = interview.integrity_report.flags.filter(f => f.severity === 'medium').length;
  const integrityPenalty = (highFlags * 5) + (medFlags * 2);

  // 5. ADAPTIVE DIFFICULTY BONUS
  const adaptiveDifficultyBonus = interview.metadata.adaptiveDifficulty === 'elevated' ? 5 : 0;

  // COMPOSITE CALCULATION
  let composite = (baseScore * completionMultiplier) + signalBonus - integrityPenalty + adaptiveDifficultyBonus;
  composite = Math.max(0, Math.min(100, Math.round(composite)));

  // CONFIDENCE
  const qualityFactor = interview.interview_quality.overallQuality * 0.4;
  const completenessFactor = completionMultiplier * 100 * 0.3;
  let integrityConfidenceFactor = 0;
  if (interview.integrity_report.overallConfidence === 'high') integrityConfidenceFactor = 30;
  else if (interview.integrity_report.overallConfidence === 'medium') integrityConfidenceFactor = 15;
  
  const confidence = Math.max(0, Math.min(100, Math.round(qualityFactor + completenessFactor + integrityConfidenceFactor)));

  // RANGE
  const rangeLow = Math.round(composite * (confidence / 100) * 0.85);
  const rangeHigh = Math.min(100, Math.round(composite * (1 + (1 - confidence / 100) * 0.3)));

  // RECOMMENDATION
  let recommendation: 'strong_hire' | 'hire' | 'maybe' | 'pass' = 'pass';
  if (composite >= 80 && confidence >= 70) recommendation = 'strong_hire';
  else if (composite >= 65 && confidence >= 50) recommendation = 'hire';
  else if (composite >= 50 || confidence < 50) recommendation = 'maybe';

  // PERCENTILE
  // We determine this by comparing composite to others that have a non-null hiring_score
  let percentileStr = "Below average";
  
  if (allHistoricalInterviews && allHistoricalInterviews.length > 0) {
    const scoredPeers = allHistoricalInterviews
      .filter(i => i.id !== interview.id && i.hiring_score != null)
      .map(i => i.hiring_score!.composite);
      
    if (scoredPeers.length >= 2) {
      const beatsCount = scoredPeers.filter(s => composite > s).length;
      const beatRatio = beatsCount / scoredPeers.length;
      if (beatRatio >= 0.90) percentileStr = "Top 10% of candidates";
      else if (beatRatio >= 0.85) percentileStr = "Top 15% of candidates";
      else if (beatRatio >= 0.75) percentileStr = "Top 25% of candidates";
      else if (beatRatio >= 0.50) percentileStr = "Top 50% of candidates";
    } else {
      // Fallback
      if (composite >= 85) percentileStr = "Top 10% of candidates";
      else if (composite >= 70) percentileStr = "Top 25% of candidates";
      else if (composite >= 55) percentileStr = "Top 50% of candidates";
    }
  } else {
    // Fallback if no history passed
    if (composite >= 85) percentileStr = "Top 10% of candidates";
    else if (composite >= 70) percentileStr = "Top 25% of candidates";
    else if (composite >= 55) percentileStr = "Top 50% of candidates";
  }

  return {
    composite,
    confidence,
    range: {
      low: rangeLow,
      high: rangeHigh
    },
    breakdown: {
      baseScore: Math.round(baseScore),
      completionMultiplier: parseFloat(completionMultiplier.toFixed(2)),
      signalBonus: parseFloat(signalBonus.toFixed(1)),
      integrityPenalty,
      adaptiveDifficultyBonus
    },
    percentile: percentileStr,
    recommendation
  };
}
