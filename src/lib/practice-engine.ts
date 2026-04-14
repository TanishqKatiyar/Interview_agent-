import type { InterviewPhase, TranscriptEntry } from './types';

export class PracticeEngine {
  private transcript: TranscriptEntry[] = [];
  public phase: 'QUESTION_1' | 'FEEDBACK_1' | 'QUESTION_2' | 'FEEDBACK_2' | 'ENDED' = 'QUESTION_1';

  constructor() {}

  addEntry(role: 'ai' | 'candidate', content: string): void {
    const isAi = role === 'ai';
    this.transcript.push({
      role,
      content,
      timestamp: 0,
      phase: 'WARM_UP',
    });

    if (!isAi) {
      this.advancePhase();
    }
  }

  private advancePhase() {
    if (this.phase === 'QUESTION_1') {
      this.phase = 'FEEDBACK_1';
    } else if (this.phase === 'FEEDBACK_1') {
      this.phase = 'QUESTION_2';
    } else if (this.phase === 'QUESTION_2') {
      this.phase = 'FEEDBACK_2';
    } else if (this.phase === 'FEEDBACK_2') {
      this.phase = 'ENDED';
    }
  }

  getTranscript(): TranscriptEntry[] {
    return [...this.transcript];
  }

  isEnded(): boolean {
    return this.phase === 'ENDED';
  }
}
