import type { TranscriptEntry, InterviewMetadata, InterviewQuality } from './types';

export function assessInterviewQuality(
  transcript: TranscriptEntry[],
  metadata: InterviewMetadata
): InterviewQuality {
  
  // 1. Calculate Balance Ratio
  let candidateWords = 0;
  let aiWords = 0;

  transcript.forEach(t => {
    const wordCount = (t.content.match(/\\b\\w+\\b/g) || []).length;
    if (t.role === 'candidate') candidateWords += wordCount;
    else aiWords += wordCount;
  });

  const totalWords = candidateWords + aiWords;
  const balanceRatio = totalWords > 0 ? candidateWords / totalWords : 0;

  // 2. Candidate Comfort (Response length trend)
  const candidateEntries = transcript.filter(t => t.role === 'candidate');
  let comfortScore = 50; 
  if (candidateEntries.length >= 4) {
    const half = Math.floor(candidateEntries.length / 2);
    const firstHalfAvg = candidateEntries.slice(0, half).reduce((sum, e) => sum + (e.content.match(/\\b\\w+\\b/g) || []).length, 0) / half;
    const secondHalfAvg = candidateEntries.slice(-half).reduce((sum, e) => sum + (e.content.match(/\\b\\w+\\b/g) || []).length, 0) / half;
    
    // Getting longer = more comfortable
    if (secondHalfAvg > firstHalfAvg * 1.2) comfortScore += 30;
    else if (secondHalfAvg < firstHalfAvg * 0.8) comfortScore -= 20;

    // Just generally answering at length is good
    if (secondHalfAvg > 50) comfortScore += 20;
  }
  comfortScore = Math.max(0, Math.min(100, Math.round(comfortScore)));

  // 3. Question tracking
  const questionsAsked = metadata.questionsAsked?.length || 0;
  const followUpsAsked = metadata.followUpsNeeded || 0;
  
  // Depth score: how often did we dig deeper?
  const depthScore = questionsAsked > 0 ? Math.min(100, Math.round((followUpsAsked / questionsAsked) * 100)) : 0;

  // Coverage score: did we hit the 5 dimensions?
  // Approximated by number of core questions asked (assuming 1 question per dimension)
  const coverageScore = Math.min(100, Math.round((questionsAsked / 5) * 100));

  // Scenario
  const scenarioCompleted = transcript.some(t => t.phase === 'SCENARIO');

  // Overall Quality
  let overallQuality = (coverageScore * 0.4) + (depthScore * 0.2) + (comfortScore * 0.2) + ((balanceRatio > 0.4 && balanceRatio < 0.8 ? 100 : 50) * 0.2);
  overallQuality = Math.round(overallQuality);

  // Recommendations
  const recommendations: string[] = [];
  if (coverageScore < 80) recommendations.push("Interview ended before all skill dimensions were tested. Consider adjusting timeouts.");
  if (depthScore < 20) recommendations.push("Few follow-up questions were asked. The system should probe deeper on vague answers.");
  if (balanceRatio < 0.4) recommendations.push("Candidate spoke for less than 40% of the interview. The AI may be talking too much.");
  if (!scenarioCompleted) recommendations.push("The role-play scenario phase was skipped. Ensure the candidate reaches this phase.");

  // Signal Strength & Reliability
  let assessmentReliability: 'high' | 'medium' | 'low' = 'low';
  let signalStrength: 'strong' | 'adequate' | 'weak' = 'weak';

  if (questionsAsked >= 5 && scenarioCompleted) {
    assessmentReliability = 'high';
    signalStrength = 'strong';
  } else if (questionsAsked >= 3) {
    assessmentReliability = 'medium';
    signalStrength = 'adequate';
  }

  if (candidateEntries.length < 3) {
    assessmentReliability = 'low';
    signalStrength = 'weak';
    recommendations.push("Severely truncated interview. The candidate did not provide enough data for a valid assessment.");
  }

  return {
    overallQuality,
    signalStrength,
    factors: {
      coverageScore,
      depthScore,
      candidateComfort: comfortScore,
      balanceRatio: parseFloat(balanceRatio.toFixed(2)),
      questionsAsked,
      followUpsAsked,
      scenarioCompleted
    },
    recommendations,
    assessmentReliability
  };
}
