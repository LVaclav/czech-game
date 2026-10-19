export type TenseKey = 'past' | 'present' | 'future';

export type PersonRowKey = 'ja' | 'ty' | 'thirdSg' | 'my' | 'vy' | 'oni';

export type GenderBinary = 'm' | 'f';
export type ThirdSgPronoun = 'on' | 'ona' | 'ono';

export type FutureMode = 'impf' | 'pf';

export interface PresentOrFutureForms {
  ja: string[];
  ty: string[];
  thirdSg: string[];
  my: string[];
  vy: string[];
  oni: string[];
}

export interface PastForms {
  ja_m: string[];
  ja_f: string[];
  ty_m: string[];
  ty_f: string[];
  on: string[];
  ona: string[];
  ono: string[];
  my: string[];
  vy: string[];
  oni: string[];
}

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2';

export interface VerbEntry {
  id: string;
  frequencyRank: number;
  level?: CefrLevel;
  infinitive: string;
  aspect: 'impf' | 'pf' | 'biaspectual';
  aspectPairInfinitive: string | null; // e.g. "udělat" for "dělat"
  english: string;
  conjugationClass: string; // e.g. "-á (5. třída)", "-uje (3. třída)", "-í (4. třída)", "nepravidelné"
  reflexive: 'se' | 'si' | null;
  mnemonicTip: string;
  exampleCz: string;
  exampleEn: string;
  forms: {
    present: PresentOrFutureForms;
    past: PastForms;
    futureImpf: PresentOrFutureForms;
    futurePf?: PresentOrFutureForms; // Present-tense conjugation of the perfective pair
  };
}

export interface SessionGenders {
  ja: GenderBinary;
  ty: GenderBinary;
  thirdSg: ThirdSgPronoun;
}

export interface ActiveTableSession {
  verbId: string;
  futureMode: FutureMode;
  genders: SessionGenders;
  /**
   * Key format: `${tense}:${personRowKey}` e.g. "past:ja", "present:oni", "future:thirdSg"
   * Value is the canonical/accepted string locked in by the user
   */
  lockedCells: Record<string, string>;
}

export interface VerbFlashcardStats {
  totalAttempts: number;
  totalCorrect: number;
  consecutiveWrong: number;
  last5Results: boolean[];
  lastReviewedAt: string | null;
  weakPrompts: Record<string, number>;
}

export interface VerbUserRecord {
  verbId: string;
  completed: boolean;
  firstCompletedAt: string;
  lastTableCompletedAt: string;
  tableCompletionsCount: number;
  inMatrixQueue: boolean;
  priorityScore: number;
  flashcards: VerbFlashcardStats;
}

export interface UserProgressBlob {
  version: 1;
  username: string;
  updatedAt: string;
  stats: {
    currentStreak: number;
    lastActiveDate: string | null;
    tablesCompletedToday: number;
    totalTablesCompleted: number;
    activeSession: ActiveTableSession | null;
  };
  verbs: Record<string, VerbUserRecord>;
}

export interface AuthUserSession {
  username: string;
  displayName: string;
  token: string;
}
