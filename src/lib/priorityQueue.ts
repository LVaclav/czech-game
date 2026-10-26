import verbsData from '../data/verbs.json';
import {
  ActiveTableSession,
  FutureMode,
  GenderBinary,
  PersonRowKey,
  SessionGenders,
  TenseKey,
  ThirdSgPronoun,
  UserProgressBlob,
  VerbEntry,
  VerbUserRecord,
} from '../types';

export const ALL_VERBS: VerbEntry[] = (verbsData as VerbEntry[]).sort(
  (a, b) => a.frequencyRank - b.frequencyRank
);

export const VERB_MAP: Record<string, VerbEntry> = Object.fromEntries(
  ALL_VERBS.map((v) => [v.id, v])
);

export const NEW_VERB_PRIORITY = 10;
export const RELAPSED_BASE_PRIORITY = 100;

export function createEmptyVerbRecord(verbId: string): VerbUserRecord {
  return {
    verbId,
    completed: false,
    firstCompletedAt: '',
    lastTableCompletedAt: '',
    tableCompletionsCount: 0,
    inMatrixQueue: true,
    priorityScore: NEW_VERB_PRIORITY,
    flashcards: {
      totalAttempts: 0,
      totalCorrect: 0,
      consecutiveWrong: 0,
      last5Results: [],
      lastReviewedAt: null,
      weakPrompts: {},
    },
  };
}

export function randomSessionGenders(): SessionGenders {
  const ja: GenderBinary = Math.random() < 0.5 ? 'm' : 'f';
  const ty: GenderBinary = Math.random() < 0.5 ? 'm' : 'f';
  const thirdOptions: ThirdSgPronoun[] = ['on', 'ona', 'ono'];
  const thirdSg = thirdOptions[Math.floor(Math.random() * thirdOptions.length)];
  return { ja, ty, thirdSg };
}

export function pickFutureMode(verb: VerbEntry): FutureMode {
  if (verb.forms.futurePf) {
    return Math.random() < 0.5 ? 'impf' : 'pf';
  }
  return 'impf';
}

export interface NextTableVerbSelection {
  verb: VerbEntry;
  reason: 'relapsed' | 'new' | 'review-cycle';
  priorityScore: number;
}

/**
 * Selects the next verb for Section 1 (Unlimited 3x2 Table Trainer):
 * 1. Highest priorityScore relapsed completed verbs (`inMatrixQueue === true && completed === true`, priority >= 100)
 * 2. Next unseen verb in frequency order (`!completed`)
 * 3. If all verbs in corpus have been completed and none are relapsed, picks the least recently practiced verb
 */
export function selectNextVerbForTable(
  progress: UserProgressBlob,
  excludeVerbId?: string
): NextTableVerbSelection {
  // 1. Check relapsed completed verbs first (priority >= 100)
  const relapsedCandidates: { verb: VerbEntry; record: VerbUserRecord }[] = [];

  for (const verb of ALL_VERBS) {
    const rec = progress.verbs[verb.id];
    if (rec && rec.completed && rec.inMatrixQueue && rec.priorityScore >= RELAPSED_BASE_PRIORITY) {
      relapsedCandidates.push({ verb, record: rec });
    }
  }

  if (relapsedCandidates.length > 0) {
    relapsedCandidates.sort((a, b) => {
      if (b.record.priorityScore !== a.record.priorityScore) {
        return b.record.priorityScore - a.record.priorityScore;
      }
      return a.verb.frequencyRank - b.verb.frequencyRank;
    });

    const picked =
      relapsedCandidates.find((c) => c.verb.id !== excludeVerbId) || relapsedCandidates[0];

    return {
      verb: picked.verb,
      reason: 'relapsed',
      priorityScore: picked.record.priorityScore,
    };
  }

  // 2. Next unseen / uncompleted verb in frequency order
  const uncompleted = ALL_VERBS.filter((v) => !progress.verbs[v.id]?.completed);
  if (uncompleted.length > 0) {
    const picked = uncompleted.find((v) => v.id !== excludeVerbId) || uncompleted[0];
    return {
      verb: picked,
      reason: 'new',
      priorityScore: NEW_VERB_PRIORITY,
    };
  }

  // 3. All verbs completed & no relapses -> cycle least recently completed
  const sortedByOldest = [...ALL_VERBS].sort((a, b) => {
    const timeA = progress.verbs[a.id]?.lastTableCompletedAt || '';
    const timeB = progress.verbs[b.id]?.lastTableCompletedAt || '';
    return timeA.localeCompare(timeB);
  });

  const picked = sortedByOldest.find((v) => v.id !== excludeVerbId) || sortedByOldest[0];
  return {
    verb: picked,
    reason: 'review-cycle',
    priorityScore: NEW_VERB_PRIORITY,
  };
}

export function createTableSessionForVerb(verb: VerbEntry): ActiveTableSession {
  return {
    verbId: verb.id,
    futureMode: pickFutureMode(verb),
    genders: randomSessionGenders(),
    lockedCells: {},
  };
}

function getTodayDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function getLocalTodayDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCalendarDayDiff(
  earlierDateKey: string,
  laterDateKey: string
): number {
  const cleanEarlier = earlierDateKey.slice(0, 10);
  const cleanLater = laterDateKey.slice(0, 10);
  const t1 = new Date(`${cleanEarlier}T00:00:00Z`).getTime();
  const t2 = new Date(`${cleanLater}T00:00:00Z`).getTime();
  if (Number.isNaN(t1) || Number.isNaN(t2)) return Infinity;
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

export function isDateToday(
  dateKey: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!dateKey) return false;
  const clean = dateKey.slice(0, 10);
  const utcToday = getTodayDateString(now);
  const localToday = getLocalTodayDateString(now);
  return clean === utcToday || clean === localToday;
}

/**
 * Returns true if `dateKey` is today or yesterday (relative to UTC or local date),
 * meaning a streak ending on `dateKey` is still active and has not been broken yet.
 */
export function isDateActiveForStreak(
  dateKey: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!dateKey) return false;
  const clean = dateKey.slice(0, 10);
  const utcToday = getTodayDateString(now);
  const localToday = getLocalTodayDateString(now);
  const diffUtc = getCalendarDayDiff(clean, utcToday);
  const diffLocal = getCalendarDayDiff(clean, localToday);
  return (diffUtc >= -1 && diffUtc <= 1) || (diffLocal >= -1 && diffLocal <= 1);
}

/**
 * Returns a complete map of YYYY-MM-DD -> activity count, combining explicit
 * `stats.activityByDate` with any historical timestamps from `lastActiveDate`
 * and completed verb records so existing accounts show all their hit days.
 */
export function getEffectiveActivityMap(
  progress: UserProgressBlob
): Record<string, number> {
  const map: Record<string, number> = {
    ...(progress.stats.activityByDate || {}),
  };

  if (progress.stats.lastActiveDate) {
    const d = progress.stats.lastActiveDate.slice(0, 10);
    map[d] = Math.max(map[d] || 0, progress.stats.tablesCompletedToday || 1);
  }

  for (const rec of Object.values(progress.verbs)) {
    if (rec.firstCompletedAt) {
      const d = rec.firstCompletedAt.slice(0, 10);
      map[d] = Math.max(map[d] || 0, 1);
    }
    if (rec.lastTableCompletedAt) {
      const d = rec.lastTableCompletedAt.slice(0, 10);
      map[d] = Math.max(map[d] || 0, 1);
    }
    if (rec.flashcards?.lastReviewedAt) {
      const d = rec.flashcards.lastReviewedAt.slice(0, 10);
      map[d] = Math.max(map[d] || 0, 1);
    }
  }

  return map;
}

/**
 * Computes the user's current active streak (in days).
 * If the user has not practiced today or yesterday, their streak is broken and returns 0.
 */
export function getActiveStreak(
  progress: UserProgressBlob,
  now: Date = new Date()
): number {
  const lastActiveDate = progress.stats.lastActiveDate;
  const storedActiveStreak = isDateActiveForStreak(lastActiveDate, now)
    ? progress.stats.currentStreak || 0
    : 0;

  const map = getEffectiveActivityMap(progress);
  const dates = Object.keys(map)
    .filter((d) => map[d] > 0)
    .sort();

  let activeRunFromDates = 0;
  if (dates.length > 0) {
    const mostRecentDate = dates[dates.length - 1];
    if (isDateActiveForStreak(mostRecentDate, now)) {
      activeRunFromDates = 1;
      for (let i = dates.length - 1; i > 0; i--) {
        const diff = getCalendarDayDiff(dates[i - 1], dates[i]);
        if (diff === 1) {
          activeRunFromDates += 1;
        } else if (diff > 1) {
          break;
        }
      }
    }
  }

  return Math.max(storedActiveStreak, activeRunFromDates);
}

/**
 * Returns the number of verb tables completed today (0 if `lastActiveDate` is not today).
 */
export function getTablesCompletedToday(
  progress: UserProgressBlob,
  now: Date = new Date()
): number {
  if (!isDateToday(progress.stats.lastActiveDate, now)) {
    return 0;
  }
  return progress.stats.tablesCompletedToday || 0;
}

/**
 * Computes the user's all-time longest streak (in days) from both `stats.longestStreak`,
 * `stats.currentStreak`, and consecutive dates in `getEffectiveActivityMap`.
 */
export function getLongestStreak(progress: UserProgressBlob): number {
  const map = getEffectiveActivityMap(progress);
  const dates = Object.keys(map)
    .filter((d) => map[d] > 0)
    .sort();

  let bestFromDates = 0;
  let currentRun = 0;
  let prevTime: number | null = null;

  for (const d of dates) {
    const t = new Date(d + 'T00:00:00Z').getTime();
    if (prevTime !== null) {
      const diffDays = Math.round((t - prevTime) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentRun += 1;
      } else if (diffDays > 1) {
        currentRun = 1;
      }
    } else {
      currentRun = 1;
    }
    if (currentRun > bestFromDates) {
      bestFromDates = currentRun;
    }
    prevTime = t;
  }

  return Math.max(
    progress.stats.longestStreak || 0,
    progress.stats.currentStreak || 0,
    bestFromDates
  );
}

/**
 * Ensures `stats.currentStreak`, `stats.longestStreak`, and `stats.tablesCompletedToday`
 * reflect whether a streak has expired, while preserving any prior streak in `longestStreak`.
 */
export function normalizeUserProgress(
  progress: UserProgressBlob,
  now: Date = new Date()
): UserProgressBlob {
  const longestStreak = getLongestStreak(progress);
  const activeStreak = getActiveStreak(progress, now);
  const tablesToday = getTablesCompletedToday(progress, now);

  if (
    progress.stats.currentStreak === activeStreak &&
    progress.stats.longestStreak === longestStreak &&
    progress.stats.tablesCompletedToday === tablesToday
  ) {
    return progress;
  }

  return {
    ...progress,
    stats: {
      ...progress.stats,
      currentStreak: activeStreak,
      longestStreak,
      tablesCompletedToday: tablesToday,
    },
  };
}

/**
 * Marks a verb's 3x2x3 table (18/18 cells) as completed:
 * - Adds/keeps it in `completed`
 * - Clears `inMatrixQueue` and resets relapse priority back to normal
 * - Updates user streak, longestStreak, activityByDate, and daily/total table counters
 */
export function recordTableCompletion(
  progress: UserProgressBlob,
  verbId: string
): UserProgressBlob {
  const nowIso = new Date().toISOString();
  const today = getTodayDateString();
  const existing = progress.verbs[verbId] || createEmptyVerbRecord(verbId);
  const previousLongest = getLongestStreak(progress);

  const updatedVerb: VerbUserRecord = {
    ...existing,
    completed: true,
    firstCompletedAt: existing.firstCompletedAt || nowIso,
    lastTableCompletedAt: nowIso,
    tableCompletionsCount: (existing.tableCompletionsCount || 0) + 1,
    inMatrixQueue: false,
    priorityScore: NEW_VERB_PRIORITY,
    flashcards: {
      ...existing.flashcards,
      // Reset relapse error streak once re-mastered in the 3x2 table!
      consecutiveWrong: 0,
      last5Results: [],
    },
  };

  let { currentStreak, lastActiveDate, tablesCompletedToday, totalTablesCompleted } =
    progress.stats;

  if (lastActiveDate !== today) {
    if (lastActiveDate) {
      const prev = new Date(lastActiveDate + 'T00:00:00Z');
      const curr = new Date(today + 'T00:00:00Z');
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      currentStreak = diffDays === 1 ? currentStreak + 1 : 1;
    } else {
      currentStreak = 1;
    }
    tablesCompletedToday = 1;
    lastActiveDate = today;
  } else {
    tablesCompletedToday += 1;
    currentStreak = Math.max(currentStreak || 0, 1);
  }

  totalTablesCompleted += 1;

  const prevActivity = getEffectiveActivityMap(progress);
  const nextActivityByDate: Record<string, number> = {
    ...prevActivity,
    [today]: Math.max((prevActivity[today] || 0) + 1, tablesCompletedToday),
  };

  const longestStreak = Math.max(
    previousLongest,
    currentStreak
  );

  const updatedProgress: UserProgressBlob = {
    ...progress,
    updatedAt: nowIso,
    stats: {
      ...progress.stats,
      currentStreak,
      longestStreak,
      lastActiveDate,
      tablesCompletedToday,
      totalTablesCompleted,
      activityByDate: nextActivityByDate,
      activeSession: null,
    },
    verbs: {
      ...progress.verbs,
      [verbId]: updatedVerb,
    },
  };

  return updatedProgress;
}

/**
 * Checks whether a completed verb has triggered the relapse rule in Flashcards:
 * Trigger: `consecutiveWrong >= 2` OR `wrongCount(last5Results) >= 3`
 */
export function evaluateRelapseCondition(
  consecutiveWrong: number,
  last5Results: boolean[]
): boolean {
  if (consecutiveWrong >= 2) {
    return true;
  }
  const wrongCount = last5Results.filter((r) => !r).length;
  return wrongCount >= 3;
}

/**
 * Records a flashcard attempt for a completed verb.
 * If the user consistently gets it wrong, the word STAYS in `completedVerbs`,
 * AND is re-queued into the Table Trainer with priority >= 100.
 */
export function recordFlashcardAttempt(
  progress: UserProgressBlob,
  verbId: string,
  promptKey: string,
  isCorrect: boolean
): { updatedProgress: UserProgressBlob; triggeredRelapse: boolean } {
  const nowIso = new Date().toISOString();
  const previousLongest = getLongestStreak(progress);
  const existing = progress.verbs[verbId] || {
    ...createEmptyVerbRecord(verbId),
    completed: true,
    firstCompletedAt: nowIso,
    lastTableCompletedAt: nowIso,
    tableCompletionsCount: 1,
  };

  const prevFc = existing.flashcards;
  const totalAttempts = prevFc.totalAttempts + 1;
  const totalCorrect = prevFc.totalCorrect + (isCorrect ? 1 : 0);
  const consecutiveWrong = isCorrect ? 0 : prevFc.consecutiveWrong + 1;
  const last5Results = [...prevFc.last5Results, isCorrect].slice(-5);

  const weakPrompts = { ...prevFc.weakPrompts };
  if (!isCorrect) {
    weakPrompts[promptKey] = (weakPrompts[promptKey] || 0) + 1;
  }

  const shouldRelapse = !isCorrect && evaluateRelapseCondition(consecutiveWrong, last5Results);
  const errorRate = Math.round(((totalAttempts - totalCorrect) / totalAttempts) * 100);

  const inMatrixQueue = existing.inMatrixQueue || shouldRelapse;
  const priorityScore = inMatrixQueue
    ? Math.max(
        existing.priorityScore,
        RELAPSED_BASE_PRIORITY + consecutiveWrong * 10 + Math.round(errorRate / 5)
      )
    : existing.priorityScore;

  const updatedVerb: VerbUserRecord = {
    ...existing,
    completed: true, // Always stays in completed list!
    inMatrixQueue,
    priorityScore,
    flashcards: {
      totalAttempts,
      totalCorrect,
      consecutiveWrong,
      last5Results,
      lastReviewedAt: nowIso,
      weakPrompts,
    },
  };

  const today = getTodayDateString();
  const prevActivity = getEffectiveActivityMap(progress);
  const nextActivityByDate: Record<string, number> = {
    ...prevActivity,
    [today]: Math.max(prevActivity[today] || 0, 1),
  };

  const draftProgress: UserProgressBlob = {
    ...progress,
    updatedAt: nowIso,
    stats: {
      ...progress.stats,
      activityByDate: nextActivityByDate,
    },
    verbs: {
      ...progress.verbs,
      [verbId]: updatedVerb,
    },
  };

  const activeStreak = getActiveStreak(draftProgress);
  const longestStreak = Math.max(previousLongest, activeStreak);

  const updatedProgress: UserProgressBlob = {
    ...draftProgress,
    stats: {
      ...draftProgress.stats,
      currentStreak: activeStreak,
      longestStreak,
      tablesCompletedToday: getTablesCompletedToday(draftProgress),
    },
  };

  return {
    updatedProgress,
    triggeredRelapse: shouldRelapse && !existing.inMatrixQueue,
  };
}

export interface FlashcardPrompt {
  verb: VerbEntry;
  tense: TenseKey;
  person: PersonRowKey;
  genders: SessionGenders;
  futureMode: FutureMode;
  promptKey: string;
}

/**
 * Picks a random flashcard from the user's `completedVerbs` pool, weighted toward
 * words with lower accuracy or older review timestamps.
 */
export function generateFlashcardPrompt(
  progress: UserProgressBlob,
  lastVerbId?: string
): FlashcardPrompt | null {
  const completedEntries = Object.values(progress.verbs).filter(
    (rec) => rec.completed && VERB_MAP[rec.verbId]
  );

  if (completedEntries.length === 0) {
    return null;
  }

  // Weight completed verbs so struggling or less-reviewed verbs appear more often
  const candidates =
    completedEntries.length > 1
      ? completedEntries.filter((c) => c.verbId !== lastVerbId)
      : completedEntries;

  const weightedPool: VerbUserRecord[] = [];
  for (const rec of candidates) {
    const attempts = rec.flashcards.totalAttempts;
    const accuracy = attempts > 0 ? rec.flashcards.totalCorrect / attempts : 0.7;
    const weight = rec.inMatrixQueue
      ? 4
      : accuracy < 0.75
      ? 3
      : attempts === 0
      ? 2
      : 1;
    for (let i = 0; i < weight; i++) {
      weightedPool.push(rec);
    }
  }

  const chosenRecord = weightedPool[Math.floor(Math.random() * weightedPool.length)];
  const verb = VERB_MAP[chosenRecord.verbId];

  const tenses: TenseKey[] = ['past', 'present', 'future'];
  const tense = tenses[Math.floor(Math.random() * tenses.length)];

  const persons: PersonRowKey[] = ['ja', 'ty', 'thirdSg', 'my', 'vy', 'oni'];
  const person = persons[Math.floor(Math.random() * persons.length)];

  const genders = randomSessionGenders();
  const futureMode = pickFutureMode(verb);

  const promptKey = `${tense}:${person}`;

  return {
    verb,
    tense,
    person,
    genders,
    futureMode,
    promptKey,
  };
}
