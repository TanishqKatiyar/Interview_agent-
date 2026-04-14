import type { TranscriptEntry, InterviewMetadata, SpeechAnalytics } from './types';

// Regex utility for counting
function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) || []).length;
}

export function analyzeSpeechPatterns(
  transcript: TranscriptEntry[],
  metadata: InterviewMetadata
): SpeechAnalytics {
  const candidateEntries = transcript.filter((t) => t.role === 'candidate');
  
  if (candidateEntries.length === 0) {
    return {
      avgResponseTime: 0,
      avgResponseLength: 0,
      responseConsistency: 0,
      vocabularyDiversity: 0,
      avgSentenceLength: 0,
      complexSentenceRatio: 0,
      questionUsage: 0,
      analogyCount: 0,
      stepByStepCount: 0,
      concreteExampleCount: 0,
      hedgingFrequency: 0,
      assertivenessScore: 0,
      selfCorrectionCount: 0,
      elaborationTrend: 'stable',
      engagementScore: 0,
    };
  }

  // Calculate Response Times (time between AI finishes and candidate starts based on approx timing logic)
  const responseTimes: number[] = [];
  for (let i = 1; i < transcript.length; i++) {
    if (transcript[i].role === 'candidate' && transcript[i - 1].role === 'ai') {
      const waitTime = transcript[i].timestamp - transcript[i - 1].timestamp;
      responseTimes.push(Math.max(0, waitTime));
    }
  }

  const avgResponseTime = responseTimes.length
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  // Word & Sentence calculations
  let totalWords = 0;
  let totalSentences = 0;
  let complexSentences = 0;
  const wordLengths: number[] = [];
  const uniqueWords = new Set<string>();

  // Patterns
  let questionUsage = 0;
  let analogyCount = 0;
  let stepByStepCount = 0;
  let concreteExampleCount = 0;
  let hedgeCount = 0;
  let selfCorrectionCount = 0;
  let assertiveCount = 0;

  const analogyRegex = /\\b(like|imagine|think of it as|similar to|it's as if)\\b/gi;
  const stepByStepRegex = /\\b(first|then|next|after that|finally)\\b/gi;
  const concreteExampleRegex = /\\b(for example|let's say|imagine you have|picture this|such as)\\b/gi;
  const hedgingRegex = /\\b(maybe|i think|sort of|kind of|probably|i guess|possibly|might)\\b/gi;
  const correctionRegex = /\\b(actually|wait no|i mean|let me rephrase|scratch that)\\b/gi;
  const complexMarkers = /,|\\b(because|although|when|if|since|unless|while)\\b/gi;
  const assertiveRegex = /\\b(definitely|certainly|absolutely|will|must|is|are|do)\\b/gi;

  candidateEntries.forEach((entry) => {
    const text = entry.content;
    const words = text.toLowerCase().match(/\\b\\w+\\b/g) || [];
    
    words.forEach(w => uniqueWords.add(w));
    
    totalWords += words.length;
    wordLengths.push(words.length);

    // Sentences
    const sentences = text.match(/[A-Z][^.!?]*[.!?]/gi) || [text];
    totalSentences += sentences.length;

    sentences.forEach(s => {
      if (s.match(complexMarkers)) complexSentences++;
    });

    questionUsage += countMatches(text, /\\b(does that make sense|right|you follow|make sense)\?\\b/gi);
    analogyCount += countMatches(text, analogyRegex);
    stepByStepCount += countMatches(text, stepByStepRegex);
    concreteExampleCount += countMatches(text, concreteExampleRegex);
    hedgeCount += countMatches(text, hedgingRegex);
    selfCorrectionCount += countMatches(text, correctionRegex);
    assertiveCount += countMatches(text, assertiveRegex);
  });

  const avgResponseLength = totalWords / candidateEntries.length;

  // Consistency (Std Dev)
  const meanLength = avgResponseLength;
  const variance = candidateEntries.reduce((acc, val) => {
    const wCount = (val.content.match(/\\b\\w+\\b/g) || []).length;
    return acc + Math.pow(wCount - meanLength, 2);
  }, 0) / candidateEntries.length;
  const responseConsistency = Math.sqrt(variance);

  // Vocabulary Diversity
  const vocabularyDiversity = totalWords > 0 ? uniqueWords.size / totalWords : 0;
  
  const avgSentenceLength = totalSentences > 0 ? totalWords / totalSentences : 0;
  const complexSentenceRatio = totalSentences > 0 ? complexSentences / totalSentences : 0;

  const hedgingFrequency = totalWords > 0 ? (hedgeCount / totalWords) * 100 : 0;
  const assertivenessScore = assertiveCount + hedgeCount > 0 
    ? assertiveCount / (assertiveCount + hedgeCount) 
    : 1; // Default highly assertive if no filler

  // Elaboration Trend (Compare first half vs second half)
  let elaborationTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (wordLengths.length >= 4) {
    const half = Math.floor(wordLengths.length / 2);
    const firstHalfAvg = wordLengths.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const secondHalfAvg = wordLengths.slice(-half).reduce((a, b) => a + b, 0) / half;
    
    if (secondHalfAvg > firstHalfAvg * 1.2) elaborationTrend = 'increasing';
    else if (secondHalfAvg < firstHalfAvg * 0.8) elaborationTrend = 'decreasing';
  }

  // Composite Engagement Score (0-100)
  let engagementScore = 50; 
  if (elaborationTrend === 'increasing') engagementScore += 20;
  if (elaborationTrend === 'decreasing') engagementScore -= 20;
  engagementScore += Math.min(20, questionUsage * 5);
  engagementScore += Math.min(10, concreteExampleCount * 5);
  engagementScore = Math.max(0, Math.min(100, Math.round(engagementScore)));

  return {
    avgResponseTime: parseFloat(avgResponseTime.toFixed(1)),
    avgResponseLength: Math.round(avgResponseLength),
    responseConsistency: parseFloat(responseConsistency.toFixed(1)),
    vocabularyDiversity: parseFloat(vocabularyDiversity.toFixed(2)),
    avgSentenceLength: Math.round(avgSentenceLength),
    complexSentenceRatio: parseFloat(complexSentenceRatio.toFixed(2)),
    questionUsage,
    analogyCount,
    stepByStepCount,
    concreteExampleCount,
    hedgingFrequency: parseFloat(hedgingFrequency.toFixed(1)),
    assertivenessScore: parseFloat(assertivenessScore.toFixed(2)),
    selfCorrectionCount,
    elaborationTrend,
    engagementScore
  };
}
