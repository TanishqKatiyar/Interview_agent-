// ============================================================================
// Cuemath AI Tutor Screener — Interview Engine v2
//
// Pure state-machine logic. No API calls, no timers, no side effects.
// The LLM prompt is what makes this feel human — not delays or filler words.
// ============================================================================

import type {
  InterviewPhase,
  TranscriptEntry,
  InterviewMetadata,
  InterviewQuestion,
  QuestionCategory,
  AdaptiveDifficulty,
} from './types';

// ─── Question Bank ───────────────────────────────────────────────────────────

const QUESTION_BANK: Record<QuestionCategory, InterviewQuestion[]> = {
  explanation_ability: [
    {
      id: 'exp-1',
      category: 'explanation_ability',
      text: "How would you explain fractions to a 9-year-old who's never seen them?",
      followUps: {
        ifVague: "Okay but what's your actual opening line when you sit down with the kid?",
        ifShort: "Yeah? And then what would you say next?",
        ifGood: "Oh nice — and what if the kid just looks at you blankly after that?",
      },
    },
    {
      id: 'exp-2',
      category: 'explanation_ability',
      text: "A kid asks you why do we even need algebra. What do you say?",
      followUps: {
        ifVague: "Right but what's your actual answer — like your first sentence to them?",
        ifShort: "And if they're not buying it?",
        ifGood: "Wait, do you actually use that example in sessions? How do kids react?",
      },
    },
    {
      id: 'exp-3',
      category: 'explanation_ability',
      text: "How would you explain negative numbers to a child?",
      followUps: {
        ifVague: "Okay but walk me through what you'd literally say or draw for them.",
        ifShort: "And if they still don't get it after that?",
        ifGood: "Ha — so do you do the temperature thing or the debt thing? Which lands better in your experience?",
      },
    },
    {
      id: 'exp-4',
      category: 'explanation_ability',
      text: "A student says they don't get percentages at all. Walk me through how you'd help.",
      followUps: {
        ifVague: "Sure, but concretely — what's the first thing you'd put in front of them?",
        ifShort: "Right, and then?",
        ifGood: "Yeah that real-world grounding works well. What's the weirdest context you've ever used to explain percentages?",
      },
    },
    {
      id: 'exp-5',
      category: 'explanation_ability',
      text: "How would you teach long division to a kid who keeps getting lost in the steps?",
      followUps: {
        ifVague: "What's the first concrete thing you'd change in how you're teaching it?",
        ifShort: "Okay and where do most kids actually trip up in your experience?",
        ifGood: "Interesting — do you think long division is even worth teaching in full anymore or is that old-school?",
      },
    },
    {
      id: 'exp-6',
      category: 'explanation_ability',
      text: "A 7-year-old asks what multiplication actually is. Not how to do it — what it IS.",
      followUps: {
        ifVague: "Right but what are the literal words you'd use?",
        ifShort: "And can you give me an example a 7-year-old would actually care about?",
        ifGood: "Yeah repeated addition is classic — have you ever tried the array or grouping framing instead?",
      },
    },
  ],

  patience_empathy: [
    {
      id: 'pat-1',
      category: 'patience_empathy',
      text: "A student's been stuck on the same problem for 5 minutes and they're getting really frustrated. What do you do?",
      followUps: {
        ifVague: "Okay but in that moment — like as the kid's about to cry — what do you actually say?",
        ifShort: "And if that doesn't snap them out of it?",
        ifGood: "Yeah stepping back helps. Have you ever had a kid just completely shut down on you?",
      },
    },
    {
      id: 'pat-2',
      category: 'patience_empathy',
      text: "You've explained something three different ways and the kid still doesn't get it. What now?",
      followUps: {
        ifVague: "What does trying a different angle actually look like for you?",
        ifShort: "Okay and what's your fourth approach?",
        ifGood: "So you go concrete before abstract — does that always work or do some kids need the opposite?",
      },
    },
    {
      id: 'pat-3',
      category: 'patience_empathy',
      text: "Tell me about a student who was really difficult to work with. What made it hard, and what did you try?",
      followUps: {
        ifVague: "Can you give me a specific moment from that experience?",
        ifShort: "And what was the turning point, if there was one?",
        ifGood: "Yeah — looking back, is there anything you'd do differently with that kid now?",
      },
    },
    {
      id: 'pat-4',
      category: 'patience_empathy',
      text: "A student says 'I'm just bad at math' with a totally defeated tone. What do you say?",
      followUps: {
        ifVague: "Like word for word — what's your first sentence back to them?",
        ifShort: "And if they keep repeating that they're bad at it?",
        ifGood: "Yeah, the fixed-mindset thing is real — have you seen a kid actually shift out of that?",
      },
    },
  ],

  adaptability: [
    {
      id: 'adp-1',
      category: 'adaptability',
      text: "You're mid-lesson and realize the student doesn't understand a prerequisite concept. What do you do?",
      followUps: {
        ifVague: "Like specifically — do you stop the lesson entirely or try to patch it mid-session?",
        ifShort: "And how do you figure out how big the gap actually is?",
        ifGood: "Yeah quick diagnostic then adjust. Do you ever have to rebuild a kid's whole mental model from scratch?",
      },
    },
    {
      id: 'adp-2',
      category: 'adaptability',
      text: "A student straight up tells you your explanation is boring. How do you react?",
      followUps: {
        ifVague: "Okay but in that moment, what do you say back to them?",
        ifShort: "And then what?",
        ifGood: "Ha, taking feedback from a 10-year-old — does that ever sting or do you find it helpful?",
      },
    },
    {
      id: 'adp-3',
      category: 'adaptability',
      text: "What separates a great math tutor from just an okay one?",
      followUps: {
        ifVague: "What's the most important one of those in your experience?",
        ifShort: "Say more — why that specifically?",
        ifGood: "Yeah the relationship part is underrated. Have you ever had a student where the relationship completely changed their results?",
      },
    },
    {
      id: 'adp-4',
      category: 'adaptability',
      text: "You notice a student zoning out halfway through a session. What's your move?",
      followUps: {
        ifVague: "What's the actual thing you'd say or do in that second?",
        ifShort: "And if the zoning out keeps happening session after session?",
        ifGood: "Yeah, calling it out gently is underrated — do you ever let them redirect the lesson themselves?",
      },
    },
  ],

  diagnostic_instinct: [
    {
      id: 'dia-1',
      category: 'diagnostic_instinct',
      text: "A student gives you a wrong answer — confidently. How do you figure out what they're actually misunderstanding?",
      followUps: {
        ifVague: "What's your first question back to them?",
        ifShort: "And what are you listening for in their answer?",
        ifGood: "Nice — so you dig into their reasoning before correcting. Do most tutors do that or rush to fix it?",
      },
    },
    {
      id: 'dia-2',
      category: 'diagnostic_instinct',
      text: "A kid keeps making the same mistake on word problems. What do you do to figure out why?",
      followUps: {
        ifVague: "Like, concretely — what's the test you'd run to narrow it down?",
        ifShort: "And once you know the source, what changes in the lesson?",
        ifGood: "Yeah the reading-vs-math diagnosis is important — how often is it actually a reading issue?",
      },
    },
    {
      id: 'dia-3',
      category: 'diagnostic_instinct',
      text: "A parent says their kid knows the material but panics in tests. How do you approach that?",
      followUps: {
        ifVague: "What's the first thing you'd actually do differently in sessions?",
        ifShort: "And how do you know if it's test anxiety vs. actually not knowing it?",
        ifGood: "Yeah separating the two is key — have you ever realized the 'test anxiety' story was wrong?",
      },
    },
  ],

  parent_communication: [
    {
      id: 'par-1',
      category: 'parent_communication',
      text: "A parent tells you their child isn't improving after two months of your tutoring. How do you handle that?",
      followUps: {
        ifVague: "Okay but what do you actually say to the parent in that conversation?",
        ifShort: "And if they push back on that?",
        ifGood: "Yeah having evidence ready is smart. Have you ever had to tell a parent this plan isn't working?",
      },
    },
    {
      id: 'par-2',
      category: 'parent_communication',
      text: "A parent wants you to push their child harder, but the kid's already overwhelmed. What do you do?",
      followUps: {
        ifVague: "What do you actually say to the parent when they ask for more?",
        ifShort: "And if the parent insists anyway?",
        ifGood: "Yeah holding that line takes confidence — have you ever lost a student because you pushed back?",
      },
    },
    {
      id: 'par-3',
      category: 'parent_communication',
      text: "How do you update parents on progress without sounding either too rosy or too negative?",
      followUps: {
        ifVague: "What's a specific phrase you'd use in a progress message?",
        ifShort: "And how often do you send those?",
        ifGood: "Yeah specifics-over-adjectives is the move — do you share the actual mistakes or just outcomes?",
      },
    },
  ],

  classroom_engagement: [
    {
      id: 'eng-1',
      category: 'classroom_engagement',
      text: "How do you make a boring topic — like long fraction drills — feel engaging for a kid?",
      followUps: {
        ifVague: "What's a specific trick you've actually used that worked?",
        ifShort: "And why do you think that works?",
        ifGood: "Yeah games-plus-stakes is a classic — do you ever let the kid design the game themselves?",
      },
    },
    {
      id: 'eng-2',
      category: 'classroom_engagement',
      text: "A student just wants to rush through problems to be done. How do you slow them down without killing their momentum?",
      followUps: {
        ifVague: "What's the specific thing you'd change in how you're running the session?",
        ifShort: "And if they resist slowing down?",
        ifGood: "Yeah — asking them to explain out loud is underrated. Do you ever have them teach you the problem?",
      },
    },
    {
      id: 'eng-3',
      category: 'classroom_engagement',
      text: "How do you start a session with a kid who clearly doesn't want to be there?",
      followUps: {
        ifVague: "What are your literal first 30 seconds with that kid?",
        ifShort: "And if the attitude doesn't shift?",
        ifGood: "Yeah meeting them where they are works — do you ever just skip the lesson plan entirely that day?",
      },
    },
  ],
};

// ─── Edge Case Type ──────────────────────────────────────────────────────────

export interface EdgeCase {
  type: 'overtime' | 'silence' | 'audio_issue';
  action: string;
}

// ─── Phase ordering ───────────────────────────────────────────────────────────

const PHASE_ORDER: InterviewPhase[] = [
  'GREETING',
  'WARM_UP',
  'CORE_ASSESSMENT',
  'SCENARIO',
  'WRAP_UP',
  'ENDED',
];

// ─── Empty metadata factory ───────────────────────────────────────────────────

function emptyMetadata(): InterviewMetadata {
  const phaseTimings = {} as Record<InterviewPhase, { start: number; end: number | null }>;
  for (const p of PHASE_ORDER) {
    phaseTimings[p] = { start: 0, end: null };
  }
  return {
    totalDuration: 0,
    candidateSpeakingTime: 0,
    aiSpeakingTime: 0,
    silenceEvents: 0,
    shortAnswerCount: 0,
    questionsAsked: [],
    followUpsNeeded: 0,
    phaseTimings,
  };
}

// ─── Random pick helpers ─────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks 4 varied questions spanning 4 different categories so Nisha doesn't
 * drill the same area repeatedly. Core categories (explanation, patience,
 * adaptability) are always included; the 4th comes from the extras
 * (diagnostic, parent comms, engagement) for breadth.
 */
function pickQuestions(): InterviewQuestion[] {
  const coreCats: QuestionCategory[] = ['explanation_ability', 'patience_empathy', 'adaptability'];
  const extraCats: QuestionCategory[] = ['diagnostic_instinct', 'parent_communication', 'classroom_engagement'];
  const picked = shuffle(coreCats).map((cat) => pickRandom(QUESTION_BANK[cat]));
  const bonus = pickRandom(QUESTION_BANK[pickRandom(extraCats)]);
  return [...picked, bonus];
}

// ═════════════════════════════════════════════════════════════════════════════
// InterviewEngine
// ═════════════════════════════════════════════════════════════════════════════

export default class InterviewEngine {
  // ── Phase & timing ──
  public phase: InterviewPhase = 'GREETING';
  private startTime: number = Date.now();

  // ── Questions ──
  public selectedQuestions: InterviewQuestion[];
  public currentQuestionIndex: number = 0;

  // ── Tracking ──
  public transcript: TranscriptEntry[] = [];
  public exchangeCount: number = 0;
  private metadata: InterviewMetadata;

  // ── Per-phase exchange counters ──
  private phaseExchanges: number = 0;  // exchanges within current phase
  private questionReacted: boolean = false; // has AI reacted at least once to current question?
  private followUpsOnCurrentQuestion: number = 0; // candidate turns on the current core question

  // ── Silence & audio issue counters ──
  private consecutiveSilences: number = 0;
  private consecutiveAudioIssues: number = 0;

  // ── Adaptive difficulty (Feature 3) ──
  private performanceSignals = {
    strongAnswers: 0,
    weakAnswers: 0,
    skippedQuestions: 0,
  };

  constructor() {
    this.selectedQuestions = pickQuestions();
    this.metadata = emptyMetadata();
    this.metadata.phaseTimings['GREETING'].start = Date.now();

    console.log(
      '[InterviewEngine] Selected questions:',
      this.selectedQuestions.map((q) => q.id),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OPENING MESSAGE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Pre-written greeting — spoken instantly without LLM latency.
   * Nisha's casual, warm opening line.
   */
  getOpeningMessage(): string {
    return "Hey! Thanks for jumping on. I'm Nisha from Cuemath. So this is gonna be super chill — just a quick chat, like 8 minutes maybe. I'll ask you a few things about how you'd teach and explain stuff to kids. No trick questions or anything. Ready to go?";
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSCRIPT
  // ═══════════════════════════════════════════════════════════════════════════

  addEntry(role: 'ai' | 'candidate', content: string): void {
    const entry: TranscriptEntry = {
      role,
      content,
      timestamp: this.getElapsedSeconds(),
      phase: this.phase,
    };
    this.transcript.push(entry);
    // Only count candidate turns for exchange tracking (avoid inflating count)
    if (role === 'candidate') {
      this.exchangeCount++;
    }
    this.phaseExchanges++;

    // Metadata: speaking time estimate (rough: 130 wpm average)
    const words = content.split(/\s+/).length;
    const estimatedSeconds = words / 130 * 60;
    if (role === 'candidate') {
      this.metadata.candidateSpeakingTime += estimatedSeconds;
      if (words < 10) this.metadata.shortAnswerCount++;
      // Reset silence/audio counters on any candidate speech
      this.consecutiveSilences = 0;
      this.consecutiveAudioIssues = 0;
      // Track answer quality for adaptive difficulty
      this.trackAnswerQuality(content);

      // Count candidate turns spent on the current core-assessment question.
      // Auto-advance after 2 candidate turns (original answer + 1 follow-up)
      // so Nisha never drills the same question into the ground.
      if (this.phase === 'CORE_ASSESSMENT' && this.questionReacted) {
        this.followUpsOnCurrentQuestion++;
        if (
          this.followUpsOnCurrentQuestion >= 2 &&
          this.currentQuestionIndex < this.selectedQuestions.length - 1
        ) {
          this.currentQuestionIndex++;
          this.questionReacted = false;
          this.followUpsOnCurrentQuestion = 0;
          console.log(
            `[InterviewEngine] Hard-advance to question ${this.currentQuestionIndex + 1}:`,
            this.selectedQuestions[this.currentQuestionIndex]?.id,
          );
        } else if (
          this.followUpsOnCurrentQuestion >= 2 &&
          this.currentQuestionIndex >= this.selectedQuestions.length - 1
        ) {
          // All questions exhausted — flag for phase advance
          this.currentQuestionIndex = this.selectedQuestions.length;
        }
      }
    } else {
      this.metadata.aiSpeakingTime += estimatedSeconds;
      // Track questions asked
      if (this.phase === 'CORE_ASSESSMENT') {
        const q = this.selectedQuestions[this.currentQuestionIndex];
        if (q && !this.metadata.questionsAsked.includes(q.text)) {
          this.metadata.questionsAsked.push(q.text);
        }
        this.questionReacted = true; // AI has responded to candidate in this phase
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns true if the engine thinks it's time to advance the phase.
   * Called after BOTH the candidate speaks and after the AI responds.
   */
  shouldAdvancePhase(): boolean {
    const elapsed = this.getElapsedSeconds();

    switch (this.phase) {
      case 'GREETING':
        // Advance after candidate says anything (any reply = ready)
        return this.transcript.some((e) => e.role === 'candidate' && e.phase === 'GREETING');

      case 'WARM_UP': {
        // Advance after 2+ candidate exchanges or 2.5 minutes
        const candidateExchanges = this.transcript.filter(
          (e) => e.role === 'candidate' && e.phase === 'WARM_UP',
        ).length;
        return candidateExchanges >= 2 || elapsed > 150;
      }

      case 'CORE_ASSESSMENT': {
        // Advance question index if AI has reacted to current answer
        // Advance phase when all questions done OR 8 minutes elapsed
        if (this.currentQuestionIndex >= this.selectedQuestions.length) return true;
        if (elapsed > 480) return true;
        return false;
      }

      case 'SCENARIO': {
        // After 3+ role-play exchanges or 10 minutes
        const scenarioExchanges = this.transcript.filter(
          (e) => e.phase === 'SCENARIO',
        ).length;
        return scenarioExchanges >= 6 || elapsed > 600;
      }

      case 'WRAP_UP': {
        // After 2+ exchanges or 11.5 minutes
        const wrapExchanges = this.transcript.filter(
          (e) => e.phase === 'WRAP_UP',
        ).length;
        return wrapExchanges >= 4 || elapsed > 690;
      }

      case 'ENDED':
        return false;
    }
  }

  advancePhase(): void {
    const now = Date.now();

    // Close current phase timing
    this.metadata.phaseTimings[this.phase].end = now;

    const currentIdx = PHASE_ORDER.indexOf(this.phase);
    const nextPhase = PHASE_ORDER[currentIdx + 1] ?? 'ENDED';

    this.phase = nextPhase;
    this.phaseExchanges = 0;
    this.questionReacted = false;
    this.followUpsOnCurrentQuestion = 0;

    // Open new phase timing
    this.metadata.phaseTimings[nextPhase].start = now;

    console.log(`[InterviewEngine] Phase: ${PHASE_ORDER[currentIdx]} → ${nextPhase}`);
  }

  /**
   * Called WITHIN CORE_ASSESSMENT after the AI has asked + reacted to a question.
   * Moves to the next question. If all done, flags for phase advance.
   */
  recordFollowUp(): void {
    this.metadata.followUpsNeeded++;

    // Move to next question if AI has reacted at least once
    if (
      this.phase === 'CORE_ASSESSMENT' &&
      this.questionReacted &&
      this.currentQuestionIndex < this.selectedQuestions.length - 1
    ) {
      this.currentQuestionIndex++;
      this.questionReacted = false;
      this.followUpsOnCurrentQuestion = 0;
      console.log(
        `[InterviewEngine] Moving to question ${this.currentQuestionIndex + 1}:`,
        this.selectedQuestions[this.currentQuestionIndex]?.id,
      );
    } else if (
      this.phase === 'CORE_ASSESSMENT' &&
      this.currentQuestionIndex >= this.selectedQuestions.length - 1 &&
      this.questionReacted
    ) {
      // All questions done — flag for phase advance
      this.currentQuestionIndex = this.selectedQuestions.length; // signals done
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM PROMPT
  // ═══════════════════════════════════════════════════════════════════════════

  buildSystemPrompt(): string {
    const phaseInstructions = this.getPhaseInstructions();
    const questionsAsked = this.metadata.questionsAsked.length > 0
      ? this.metadata.questionsAsked.map((q, i) => `${i + 1}. "${q}"`).join('\n')
      : 'None yet.';

    // Build a clear question roadmap so the LLM never re-asks covered questions
    const questionRoadmap = this.selectedQuestions.map((q, i) => {
      let status = '[ UPCOMING ]';
      if (i < this.currentQuestionIndex) status = '[ DONE ✓ ]';
      else if (i === this.currentQuestionIndex) status = '[ CURRENT → ]';
      return `  Q${i + 1}. ${status} (${q.category}) "${q.text}"`;
    }).join('\n');

    return `You are Nisha, a 32-year-old senior hiring manager at Cuemath who has personally interviewed over 500 tutor candidates. You came up as a math teacher yourself — eight years in classrooms before moving into hiring. You genuinely love teaching and get excited when candidates show real depth, not rehearsed answers.

You are on a VOICE CALL. Everything you say gets spoken aloud through text-to-speech. This is not a chat — it's a real conversation.

YOUR VOICE RULES:
- 2 sentences max per response. Seriously — two. You're chatting, not giving a speech.
- Use contractions always: "you'd", "that's", "I'd", "don't", "won't", "we're". Nobody speaks formally on a call.
- Use casual connectors to start responses: "So...", "Oh interesting,", "Yeah so...", "Hmm okay,", "Oh wait,", "Ha, nice,", "Mm,"
- VERY IMPORTANT: To fix robotic AI voices, you MUST use conversational filler words actively mid-sentence (e.g., "I mean", "you know", "like", "gotcha", "yeah"). 
- Speak in short, punchy sentence fragments occasionally. People don't speak in perfectly grammatical paragraphs. Break up the text.
- No bullet points. No lists. No markdown. No asterisks. No formatting. Just natural spoken words.

HOW YOU REACT (this is what makes you feel real):

After a GOOD answer — pick ONE specific thing they said and react to THAT:
  WRONG: "That's a great approach! I love how you think about it."
  RIGHT: "Oh the pizza slices thing, yeah that actually works really well with younger kids."
  RIGHT: "Wait you draw it out on paper with them? That's clever."

After a VAGUE answer — ask for the specific thing that's missing:
  WRONG: "Could you elaborate on that?"
  RIGHT: "Okay but like, what would you actually say to the kid? Like your exact opening line."
  RIGHT: "Right but what happens when they just stare at you blankly after that?"

After a SHORT answer (few words only):
  WRONG: "Could you tell me more about that?"
  RIGHT: "Yeah? And then what?"
  RIGHT: "Okay and if that doesn't work?"

After a LONG answer — pick the single most interesting thread and pull on it:
  RIGHT: "Wait go back to the part about using their toys as examples. How does that work exactly?"

When they seem NERVOUS:
  WRONG: "Don't worry, there are no wrong answers here!"
  RIGHT: "Hey you're doing totally fine. This isn't a test, I'm just curious how you think."

TRANSITIONS between questions:
  WRONG: "Now let me ask you about a different topic."
  RIGHT: "Cool. Okay totally different thing — "
  RIGHT: "Nice. So here's a fun one — "
  RIGHT: "Alright switching gears — "

WORDS AND PHRASES YOU NEVER USE (these instantly sound like AI):
- "That's a great question/answer/point"
- "I appreciate you sharing that"
- "Absolutely!" / "Wonderful!" / "Fantastic!"
- "That's really insightful"
- "Thank you for your thoughtful response"
- "Let me ask you another question"
- "Moving on to the next topic"
- Starting with "I love..." or "I think that's..."
- Any response longer than 2 sentences when reacting to an answer

WHAT YOU'RE SECRETLY EVALUATING (never tell the candidate, just probe):
1. Concreteness — do they reach for SPECIFIC kid-facing language and examples, or do they hide behind buzzwords like "engagement", "scaffolding", "student-centered"?
2. Diagnostic instinct — when a kid is stuck, do they form a hypothesis about WHAT'S blocking the kid, or just retry harder?
3. Patience under pressure — do they get defensive or testy when you push back? Real tutors stay curious.
4. Mathematical correctness — quietly check that the math/teaching they describe is actually right. Pizza = good for halves; money = good for decimals; number line = good for negatives. Wrong analogies are a red flag.
5. Empathy without condescension — do they describe kids respectfully, or as "slow", "lazy", "weak"? Anything dismissive is a hard no.
6. Adaptability — when their first explanation fails, do they switch frame (concrete↔abstract, visual↔verbal) or just say it again louder?
7. Ownership — when a session goes badly, do they look at what they could've done differently, or blame the kid/parent?

PROBING TOOLKIT (use these intentionally, not all at once):
- "Walk me through the first 30 seconds with that kid."
- "What's the exact word you'd use there — not the textbook word, the kid word?"
- "Okay but what's plan B if that lands flat?"
- "How would you know it actually clicked for them?"
- "Have you actually done this with a real kid, or is this theoretical?"

NEVER COACH THE CANDIDATE. Never feed them the answer. Never say "you could try…". You're evaluating, not training. The closest you go is "interesting, what made you go that direction?"

STRICT DRILLING RULE (important):
- At MOST one follow-up per main question before moving on. Never two, never three.
- After you've asked the main question AND done one follow-up, you MUST transition to the next question — even if you're curious to go deeper.
- The goal is BREADTH across topics, not depth on any single one. A real hiring manager samples many skills.
- Signs you need to move on NOW: you've already said something like "and what if…" or "okay and then…" or "say more about…" for this question. Once = fine, twice = wrong.
- Transition cleanly: "Got it. Alright totally different thing — [next question]"

NEVER end the call yourself before WRAP_UP unless the candidate explicitly asks to stop.

CURRENT PHASE: ${this.phase}
ADAPTIVE DIFFICULTY: ${this.getAdaptiveDifficulty()}

${phaseInstructions}

${this.getAdaptiveInstructions()}

QUESTIONS ALREADY ASKED:
${questionsAsked}

QUESTION ROADMAP (follow this order, NEVER revisit a [DONE] question):
${questionRoadmap}

CANDIDATE TURNS SO FAR: ${this.exchangeCount}

You are Nisha. Relaxed, genuine, direct, sharp. You don't perform warmth — you just care about finding good tutors for kids.`;
  }

  private getPhaseInstructions(): string {
    switch (this.phase) {
      case 'GREETING':
        return `Start the call casually. Say something like: "Hey! Thanks for jumping on. I'm Nisha from Cuemath. So this is super chill, just a quick chat — like 8 minutes maybe. I'm gonna ask you a few things about how you'd teach and explain stuff to kids. Totally no trick questions. Ready to go?"`;

      case 'WARM_UP':
        return `Get them talking with one easy question. Pick one: "So what got you into tutoring in the first place?" or "Have you worked with kids before? What ages?" React naturally to whatever they say and then transition to the main questions.`;

      case 'CORE_ASSESSMENT': {
        const q = this.selectedQuestions[this.currentQuestionIndex];
        if (!q) {
          // All questions done — wrap up core
          return `You've covered all the main questions. Transition naturally to the role-play: "Okay, so here's something a bit different and kind of fun..."`;
        }
        const qNum = this.currentQuestionIndex + 1;
        const total = this.selectedQuestions.length;
        const usedFollowUp = this.followUpsOnCurrentQuestion >= 1;
        return `Current question ${qNum} of ${total}. You have already used ${this.followUpsOnCurrentQuestion} follow-up(s) on this question.

If the main question has NOT been asked yet this turn, ask it: "${q.text}"

After their answer, react to something specific they said using their own words. Then:
- ${usedFollowUp ? 'YOU MUST MOVE ON NOW. Do NOT ask another follow-up. Transition: "Got it. Alright totally different thing — [next question]"' : 'You may ask ONE follow-up (pick the one that fits):'}
  - If answer was vague: "${q.followUps.ifVague}"
  - If answer was short: "${q.followUps.ifShort}"
  - If answer was good: "${q.followUps.ifGood}"
- After that ONE follow-up, you must transition to the next question. No second follow-up, no matter how tempting.`;
      }

      case 'SCENARIO':
        return `Set up the role-play: "Okay so here's a fun thing — I'm gonna pretend I'm a 10-year-old who's completely lost on fractions. Just explain it to me like I'm your student, make it fun."

Then BE a confused 10-year-old kid:
- After first explanation: "Wait I don't get it. Why can't I just add the top numbers together?"
- After second try: "Ohhh... is it like pieces of a pizza?" or stay confused if their explanation wasn't clear
- After third exchange or when natural: break character casually: "Ha okay nice, you handled that well."

Use kid words. Be a little impatient. Test their patience.`;

      case 'WRAP_UP':
        return `Wrap it up naturally: "Alright that's everything I had! Any questions about Cuemath or the role?" Answer any questions briefly. Then: "Cool, thanks a ton for chatting. You'll hear from us in a couple days. Take care!" Keep it natural like ending a real phone call.`;

      case 'ENDED':
        return `The interview has ended. Do not generate any more responses.`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  checkEdgeCases(): EdgeCase | null {
    const elapsed = this.getElapsedSeconds();

    // Hard overtime cap — 12 minutes
    if (elapsed > 720 && this.phase !== 'ENDED' && this.phase !== 'WRAP_UP') {
      return {
        type: 'overtime',
        action: "Hey, we're actually running a little over time — my bad! Let's wrap up here. Thanks so much for chatting, this was great. You'll hear from us soon!",
      };
    }

    // Consecutive silence events
    if (this.consecutiveSilences >= 2) {
      this.consecutiveSilences = 0;
      return {
        type: 'silence',
        action: "Hey no worries — take your time. Or if you're not sure, just take a stab at it.",
      };
    }

    // Audio issues
    if (this.consecutiveAudioIssues >= 3) {
      this.consecutiveAudioIssues = 0;
      return {
        type: 'audio_issue',
        action: "Hey sorry — I'm having a bit of trouble hearing you. Could you try speaking a little louder?",
      };
    }

    return null;
  }

  flagLongSilence(): void {
    this.consecutiveSilences++;
    this.metadata.silenceEvents++;
  }

  flagAudioIssue(): void {
    this.consecutiveAudioIssues++;
  }

  forceEnd(): void {
    const elapsed = this.getElapsedSeconds();
    console.log(`[InterviewEngine] Force-ended at ${elapsed} s`);

    // Close all open phase timings
    const now = Date.now();
    for (const p of PHASE_ORDER) {
      if (this.metadata.phaseTimings[p].start > 0 && this.metadata.phaseTimings[p].end === null) {
        this.metadata.phaseTimings[p].end = now;
      }
    }

    this.metadata.phaseTimings['ENDED'].start = now;
    this.metadata.phaseTimings['ENDED'].end = now;
    this.phase = 'ENDED';
    this.metadata.totalDuration = elapsed;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSCRIPT COMPRESSION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns a compressed transcript for LLM context management.
   * Keeps last 6 messages in full; summarizes older ones to save tokens.
   */
  getCompressedTranscript(): TranscriptEntry[] {
    const full = this.transcript;
    
    if (full.length <= 8) return full; // short enough, send all
    
    // Keep first 2 entries (greeting — sets context)
    const first = full.slice(0, 2);
    
    // Keep last 6 entries (recent context — most important for natural response)
    const recent = full.slice(-6);
    
    // Summarize everything in between as ONE entry
    const middle = full.slice(2, -6);
    const summaryParts: string[] = [];
    
    for (const entry of middle) {
      if (entry.role === 'ai') {
        // Compress AI messages to just the question asked
        const shortened = entry.content.length > 60 
          ? entry.content.slice(0, 60) + '...' 
          : entry.content;
        summaryParts.push(`Nisha asked: ${shortened}`);
      } else {
        const shortened = entry.content.length > 80 
          ? entry.content.slice(0, 80) + '...' 
          : entry.content;
        summaryParts.push(`Candidate said: ${shortened}`);
      }
    }
    
    const summaryEntry: TranscriptEntry = {
      role: 'ai',
      content: `[Earlier in the conversation: ${summaryParts.join(' | ')}]`,
      timestamp: middle[0]?.timestamp || 0,
      phase: middle[0]?.phase || 'WARM_UP',
    };
    
    return [...first, summaryEntry, ...recent];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════════════════

  getCurrentPhase(): InterviewPhase {
    return this.phase;
  }

  getTranscript(): TranscriptEntry[] {
    return this.transcript;
  }

  getMetadata(): InterviewMetadata {
    this.metadata.totalDuration = this.getElapsedSeconds();
    this.metadata.adaptiveDifficulty = this.getAdaptiveDifficulty();
    return { ...this.metadata };
  }

  getElapsedSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  isEnded(): boolean {
    return this.phase === 'ENDED';
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ADAPTIVE DIFFICULTY (Feature 3)
  // ═════════════════════════════════════════════════════════════════════════════

  /**
   * Assess the quality of a candidate's answer to adjust difficulty.
   */
  private trackAnswerQuality(content: string): void {
    const quality = this.assessAnswerQuality(content);
    if (quality === 'strong') this.performanceSignals.strongAnswers++;
    else if (quality === 'weak') this.performanceSignals.weakAnswers++;
  }

  private assessAnswerQuality(content: string): 'strong' | 'weak' | 'medium' {
    const wordCount = content.split(/\s+/).length;
    const hasExample = /for example|like when|such as|imagine|picture this|let's say/i.test(content);
    const hasStructure = /first|then|after that|step|finally|next/i.test(content);
    const isSkip = /don't know|not sure|skip|no idea|pass/i.test(content);

    if (isSkip) {
      this.performanceSignals.skippedQuestions++;
      return 'weak';
    }
    if (wordCount < 10) return 'weak';
    if ((hasExample || hasStructure) && wordCount > 40) return 'strong';
    return 'medium';
  }

  getAdaptiveDifficulty(): AdaptiveDifficulty {
    const { strongAnswers, weakAnswers } = this.performanceSignals;
    if (strongAnswers >= 2 && weakAnswers === 0) return 'elevated';
    if (weakAnswers >= 2) return 'simplified';
    return 'standard';
  }

  private getAdaptiveInstructions(): string {
    const difficulty = this.getAdaptiveDifficulty();

    if (difficulty === 'elevated') {
      return `DIFFICULTY ADJUSTMENT: This candidate is performing well. Challenge them with harder follow-ups.
Instead of accepting their first answer, push deeper:
- "Okay but what if the student ALSO has a language barrier?"
- "What if this is a group of 5 kids at different levels?"
- In SCENARIO phase: be a MORE difficult confused student who pushes back harder and asks tricky questions.`;
    }

    if (difficulty === 'simplified') {
      return `DIFFICULTY ADJUSTMENT: This candidate seems to be struggling. Be extra encouraging.
Simplify your questions:
- Instead of abstract scenarios, ask concrete ones: "Tell me about a time you actually helped someone understand something — doesn't have to be math."
- Use shorter, simpler follow-ups: "Yeah? And then what happened?"
- In SCENARIO phase: be an EASIER confused student who gets it quickly and makes the candidate feel successful.`;
    }

    return ''; // standard — no extra instructions
  }
}
