export interface Question {
  i: number;
  q: string;
  o: string[];
  a: number; // 0-based index of correct option
  e?: string | null; // explanation
  t?: string | null; // topic/tag
  s?: number | null; // seconds timer override
}

export interface SanitizedQuestion {
  i: number;
  q: string;
  o: string[];
  s?: number | null;
  t?: string | null;
}

export interface QuizSettings {
  mode: 'student' | 'teacher';
  shuffle?: boolean;
  timerAll?: number | null;
  lifelines?: number;
  showExplanation?: boolean;
  allowRestart?: boolean;
  locked?: boolean;
}

export interface LiveState {
  phase: 'lobby' | 'question' | 'reveal' | 'board' | 'between' | 'skipped';
  q?: number | null;
  pos?: number | null;
  seq?: number;
  started_at?: string | null;
  ends_at?: string | null;
  skipped?: number[];
}

export interface PlayerAnswerRecord {
  i: number;
  c: number; // chosen index (-1 if timeout)
  ok: boolean;
  points: number;
  ms: number;
}

export interface Player {
  id: string;
  name: string;
  pin: string;
  quiz_code: string;
  score: number;
  correct: number;
  wrong: number;
  answered: number;
  streak: number;
  best_streak: number;
  finished: boolean;
  q_order?: number[];
  done: PlayerAnswerRecord[];
  fifty?: { i: number; h: number[] }[];
  fifty_used: number;
  created_at: string;
  last_active: number;
}

export interface Quiz {
  code: string;
  title: string;
  status: 'lobby' | 'live' | 'paused' | 'ended';
  settings: QuizSettings;
  questions: Question[];
  live: LiveState;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  username: string;
  passwordHash: string;
  salt: string;
  mustChange: boolean;
}
