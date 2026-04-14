import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load env vars
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

const DEMOS = [
  {
    name: 'Demo Candidate 1 (Strong Pass)',
    email: 'demo1@cuemath.test',
    score: 4.8,
    rec: 'strong_pass',
    hireRec: 'strong_hire',
    desc: 'Excellent candidate, gave super clear explanations, perfect warmth.',
    composite: 89,
    dur: 280,
  },
  {
    name: 'Demo Candidate 2 (Pass)',
    email: 'demo2@cuemath.test',
    score: 4.2,
    rec: 'pass',
    hireRec: 'hire',
    desc: 'Solid answers, a bit long-winded but patiently explained the math.',
    composite: 78,
    dur: 300,
  },
  {
    name: 'Demo Candidate 3 (Pass)',
    email: 'demo3@cuemath.test',
    score: 3.9,
    rec: 'pass',
    hireRec: 'hire',
    desc: 'Good underlying logic but struggled slightly with 8-year old age phrasing.',
    composite: 75,
    dur: 240,
  },
  {
    name: 'Demo Candidate 4 (Borderline)',
    email: 'demo4@cuemath.test',
    score: 3.2,
    rec: 'borderline',
    hireRec: 'maybe',
    desc: 'Needed a lot of probing. Explanations were a bit too academic.',
    composite: 62,
    dur: 350,
  },
  {
    name: 'Demo Candidate 5 (Fail)',
    email: 'demo5@cuemath.test',
    score: 2.1,
    rec: 'fail',
    hireRec: 'pass',
    desc: 'Candidate was impatient and did not explain the fraction logic correctly.',
    composite: 40,
    dur: 150,
  },
  {
    name: 'Demo Candidate 6 (Strong Pass)',
    email: 'demo6@cuemath.test',
    score: 4.9,
    rec: 'strong_pass',
    hireRec: 'strong_hire',
    desc: 'Extremely engaging. Used a pizza analogy perfectly for fractions.',
    composite: 92,
    dur: 310,
  },
  {
    name: 'Demo Candidate 7 (Pass)',
    email: 'demo7@cuemath.test',
    score: 4.0,
    rec: 'pass',
    hireRec: 'hire',
    desc: 'Good communication, though a bit formal in the warm-up.',
    composite: 76,
    dur: 290,
  },
  {
    name: 'Demo Candidate 8 (Borderline)',
    email: 'demo8@cuemath.test',
    score: 3.4,
    rec: 'borderline',
    hireRec: 'maybe',
    desc: 'Struggled to connect the student to the topic but eventually got there.',
    composite: 64,
    dur: 330,
  },
  {
    name: 'Demo Candidate 9 (Fail)',
    email: 'demo9@cuemath.test',
    score: 2.5,
    rec: 'fail',
    hireRec: 'pass',
    desc: 'Short, one-sentence answers. No depth to pedagogical approach.',
    composite: 45,
    dur: 120,
  },
  {
    name: 'Demo Candidate 10 (Strong Pass)',
    email: 'demo10@cuemath.test',
    score: 4.6,
    rec: 'strong_pass',
    hireRec: 'strong_hire',
    desc: 'Enthusiastic explainer, handled the scenario question with empathy.',
    composite: 85,
    dur: 260,
  },
];

async function seed() {
  console.log('Seeding demo candidates...');

  for (const demo of DEMOS) {
    const isBad = demo.rec === 'fail' || demo.rec === 'borderline';
    
    // Build fake transcript
    const transcript = [
      { role: 'ai', content: 'Hi, welcome to the interview!', timestamp: 0, phase: 'GREETING' },
      { role: 'candidate', content: 'Hi, thank you.', timestamp: 5, phase: 'GREETING' },
      { role: 'ai', content: 'Let us jump to the scenario. How would you explain fractions to a 5-year-old?', timestamp: 8, phase: 'SCENARIO' },
      { 
        role: 'candidate', 
        content: isBad ? 'I would just tell them it is part of a whole number.' : 'I would use a pizza analogy. If we have a pizza and cut it into 4 slices, one slice is a quarter of the whole pizza. It makes it visual for them.', 
        timestamp: 15, 
        phase: 'SCENARIO' 
      },
      { role: 'ai', content: 'Thanks. That concludes our demo.', timestamp: 30, phase: 'WRAP_UP' }
    ];

    const assessment = {
      dimensions: {
        communication_clarity: {
          score: demo.score,
          evidence: ['Clear response provided.'],
          reasoning: 'The candidate was ' + (isBad ? 'unclear' : 'very clear'),
        },
        warmth_and_rapport: {
          score: isBad ? rand(2, 3.5) : rand(3.5, 5),
          evidence: ['Tone of voice.'],
          reasoning: isBad ? 'Seemed slightly abrupt.' : 'Very warm and engaging tone.',
        },
        simplification_ability: {
          score: isBad ? rand(1.5, 3) : rand(3.8, 5),
          evidence: ['Explaining fractions.'],
          reasoning: isBad ? 'Failed to simplify.' : 'Great use of analogies.',
        },
        patience_indicators: {
          score: demo.score,
          evidence: ['Wait time.'],
          reasoning: 'Allowed the interviewer to finish.',
        },
        english_fluency: {
          score: rand(4.0, 5.0),
          evidence: ['Grammar and structure.'],
          reasoning: 'Excellent English fluency.',
        }
      },
      overall_score: demo.score,
      recommendation: demo.rec,
      red_flags: isBad ? ['Short answers', 'Lack of analogies'] : [],
      strengths: isBad ? [] : ['Great tone', 'Visual analogies used'],
      areas_for_improvement: ['Could ask more checking questions'],
      summary: demo.desc,
      confidence: 'high',
      teaching_persona: {
        type: 'enthusiastic_explainer',
        label: 'Enthusiastic Explainer',
        description: 'Loves using real world analogies.',
        best_for: 'Visual learners'
      }
    };

    const hiring_score = {
      composite: demo.composite,
      confidence: rand(80, 98),
      range: { low: demo.composite - 5, high: demo.composite + 5 },
      breakdown: {
        baseScore: demo.composite - 10,
        completionMultiplier: 1.0,
        signalBonus: 5,
        integrityPenalty: 0,
        adaptiveDifficultyBonus: 5
      },
      percentile: isBad ? 'Bottom 20%' : 'Top 15%',
      recommendation: demo.hireRec
    };

    const metadata = {
      totalDuration: demo.dur,
      candidateSpeakingTime: demo.dur * 0.6,
      aiSpeakingTime: demo.dur * 0.3,
      silenceEvents: isBad ? 3 : 0,
      shortAnswerCount: isBad ? 4 : 0,
      questionsAsked: ['How to explain fractions'],
      followUpsNeeded: isBad ? 3 : 0,
      phaseTimings: {
        GREETING: { start: 0, end: 10 },
        WARM_UP: { start: 10, end: 30 },
        CORE_ASSESSMENT: { start: 30, end: null },
        SCENARIO: { start: null, end: null },
        WRAP_UP: { start: null, end: null },
        ENDED: { start: null, end: null }
      }
    };

    const speech_analytics = {
      avgResponseTime: 1.2,
      avgResponseLength: isBad ? 15 : 45,
      responseConsistency: 0.8,
      vocabularyDiversity: 0.7,
      avgSentenceLength: 12,
      complexSentenceRatio: 0.4,
      questionUsage: 2,
      analogyCount: isBad ? 0 : 2,
      stepByStepCount: 1,
      concreteExampleCount: isBad ? 0 : 1,
      hedgingFrequency: 0.1,
      assertivenessScore: 0.7,
      selfCorrectionCount: 1,
      elaborationTrend: 'increasing',
      engagementScore: isBad ? 40 : 85
    };

    const integrity_report = {
      overallConfidence: 'high',
      flags: [],
      summary: 'No integrity issues detected.'
    };

    const interview_quality = {
      overallQuality: 0.9,
      signalStrength: 'strong',
      factors: {
        coverageScore: 0.9,
        depthScore: 0.8,
        candidateComfort: 0.85,
        balanceRatio: 0.5,
        questionsAsked: 1,
        followUpsAsked: 0,
        scenarioCompleted: true
      },
      recommendations: [],
      assessmentReliability: 'high'
    };

    const now = new Date();
    // randomize created_at within last 7 days
    now.setDate(now.getDate() - Math.floor(Math.random() * 7));

    const item = {
      id: generateId(),
      candidate_name: demo.name,
      candidate_email: demo.email,
      status: 'assessed',
      interview_token: generateId(),
      started_at: now.toISOString(),
      completed_at: new Date(now.getTime() + demo.dur * 1000).toISOString(),
      duration_seconds: demo.dur,
      transcript: transcript,
      audio_url: null,
      assessment: assessment,
      overall_score: demo.score,
      recommendation: demo.rec,
      metadata: metadata,
      coaching_feedback: [
        { type: 'strength', text: 'Good tone.' }
      ],
      speech_analytics: speech_analytics,
      integrity_report: integrity_report,
      interview_quality: interview_quality,
      hiring_score: hiring_score,
      created_at: now.toISOString()
    };

    // Insert into Supabase
    const { error } = await supabase.from('interviews').insert(item);
    if (error) {
      console.error('Failed to insert ' + demo.name, error);
    } else {
      console.log('Inserted ' + demo.name);
    }
  }

  console.log('Finished seeding.');
}

seed();
