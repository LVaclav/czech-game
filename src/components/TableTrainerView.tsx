import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  Flame,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  ActiveTableSession,
  FutureMode,
  PersonRowKey,
  TenseKey,
  UserProgressBlob,
  VerbEntry,
} from '../types';
import {
  formatPersonLabel,
  getExpectedForms,
  validateCzechAnswer,
} from '../lib/validator';
import {
  createTableSessionForVerb,
  NextTableVerbSelection,
  recordTableCompletion,
  selectNextVerbForTable,
  VERB_MAP,
} from '../lib/priorityQueue';

interface TableTrainerViewProps {
  progress: UserProgressBlob;
  onUpdateProgress: (next: UserProgressBlob) => void;
  forcedVerbId: string | null;
  onClearForcedVerb: () => void;
  activeInputRef: React.MutableRefObject<HTMLInputElement | null>;
}

const TENSES: { key: TenseKey; titleCz: string; titleEn: string }[] = [
  { key: 'past', titleCz: 'Minulý čas', titleEn: 'Past Tense' },
  { key: 'present', titleCz: 'Přítomný čas', titleEn: 'Present Tense' },
  { key: 'future', titleCz: 'Budoucí čas', titleEn: 'Future Tense' },
];

/**
 * 3 rows × 2 columns layout:
 * Row 1: Já (Col 1) | My (Col 2)
 * Row 2: Ty (Col 1) | Vy (Col 2)
 * Row 3: On/Ona/Ono (Col 1) | Oni (Col 2)
 */
const GRID_ROWS: [PersonRowKey, PersonRowKey][] = [
  ['ja', 'my'],
  ['ty', 'vy'],
  ['thirdSg', 'oni'],
];

const ORDERED_PERSONS: PersonRowKey[] = ['ja', 'my', 'ty', 'vy', 'thirdSg', 'oni'];

interface CellFeedback {
  status: 'error';
  hint?: string;
  revealedAnswer?: string;
}

export const TableTrainerView: React.FC<TableTrainerViewProps> = ({
  progress,
  onUpdateProgress,
  forcedVerbId,
  onClearForcedVerb,
  activeInputRef,
}) => {
  const [selectionInfo, setSelectionInfo] = useState<NextTableVerbSelection>(() => {
    if (forcedVerbId && VERB_MAP[forcedVerbId]) {
      const rec = progress.verbs[forcedVerbId];
      return {
        verb: VERB_MAP[forcedVerbId],
        reason: rec?.inMatrixQueue && rec.priorityScore >= 100 ? 'relapsed' : 'new',
        priorityScore: rec?.priorityScore || 10,
      };
    }
    const existingSession = progress.stats.activeSession;
    if (existingSession && VERB_MAP[existingSession.verbId]) {
      const rec = progress.verbs[existingSession.verbId];
      return {
        verb: VERB_MAP[existingSession.verbId],
        reason: rec?.inMatrixQueue && rec.priorityScore >= 100 ? 'relapsed' : 'new',
        priorityScore: rec?.priorityScore || 10,
      };
    }
    return selectNextVerbForTable(progress);
  });

  const [session, setSession] = useState<ActiveTableSession>(() => {
    if (forcedVerbId && VERB_MAP[forcedVerbId]) {
      return createTableSessionForVerb(VERB_MAP[forcedVerbId]);
    }
    const existing = progress.stats.activeSession;
    if (existing && VERB_MAP[existing.verbId]) {
      return existing;
    }
    const nextSel = selectNextVerbForTable(progress);
    return createTableSessionForVerb(nextSel.verb);
  });

  const [inputs, setInputs] = useState<Record<string, string>>(() => ({
    ...session.lockedCells,
  }));
  const [cellFeedback, setCellFeedback] = useState<Record<string, CellFeedback>>({});
  const [mobileTense, setMobileTense] = useState<TenseKey>('past');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [justCompletedWord, setJustCompletedWord] = useState(false);

  const cellInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const verb: VerbEntry = VERB_MAP[session.verbId] || selectionInfo.verb;
  const totalLocked = Object.keys(session.lockedCells).length;
  const isAll18Complete = totalLocked === 18;

  // Handle jumping to a specific verb from CompletedListView
  useEffect(() => {
    if (forcedVerbId && VERB_MAP[forcedVerbId]) {
      const targetVerb = VERB_MAP[forcedVerbId];
      const rec = progress.verbs[forcedVerbId];
      const newSession = createTableSessionForVerb(targetVerb);
      setSelectionInfo({
        verb: targetVerb,
        reason: rec?.inMatrixQueue && rec.priorityScore >= 100 ? 'relapsed' : 'review-cycle',
        priorityScore: rec?.priorityScore || 10,
      });
      setSession(newSession);
      setInputs({});
      setCellFeedback({});
      setMobileTense('past');
      setJustCompletedWord(false);
      onClearForcedVerb();
    }
  }, [forcedVerbId, onClearForcedVerb, progress.verbs]);

  const getTenseLockedCount = (tense: TenseKey): number => {
    return ORDERED_PERSONS.filter((p) => Boolean(session.lockedCells[`${tense}:${p}`])).length;
  };

  const handleInputChange = (cellKey: string, value: string) => {
    setInputs((prev) => ({ ...prev, [cellKey]: value }));
    if (cellFeedback[cellKey]) {
      setCellFeedback((prev) => {
        const copy = { ...prev };
        delete copy[cellKey];
        return copy;
      });
    }
  };

  const focusNextUnlockedCell = (
    currentTense: TenseKey,
    currentPerson: PersonRowKey,
    lockedMap: Record<string, string>
  ) => {
    const allCells: { tense: TenseKey; person: PersonRowKey }[] = [];
    for (const t of TENSES) {
      for (const p of ORDERED_PERSONS) {
        allCells.push({ tense: t.key, person: p });
      }
    }

    const currIdx = allCells.findIndex(
      (c) => c.tense === currentTense && c.person === currentPerson
    );

    for (let offset = 1; offset <= allCells.length; offset++) {
      const candidate = allCells[(currIdx + offset) % allCells.length];
      const key = `${candidate.tense}:${candidate.person}`;
      if (!lockedMap[key]) {
        if (candidate.tense !== currentTense) {
          setMobileTense(candidate.tense);
        }
        setTimeout(() => {
          const el = cellInputRefs.current[key];
          if (el) {
            el.focus();
            activeInputRef.current = el;
          }
        }, 30);
        return;
      }
    }
  };

  /**
   * Validates either a single tense table (6 cells) or all 3 tenses (18 cells).
   * Correct cells lock in (`✅`), wrong cells remain editable (`❌`) until all 18/18 are right.
   */
  const validateCells = (targetTenses: TenseKey[]) => {
    const nextLocked = { ...session.lockedCells };
    const nextInputs = { ...inputs };
    const nextFeedback = { ...cellFeedback };
    let firstWrongCellKey: { tense: TenseKey; key: string } | null = null;

    for (const tense of targetTenses) {
      for (const person of ORDERED_PERSONS) {
        const cellKey = `${tense}:${person}`;
        if (nextLocked[cellKey]) continue;

        const userVal = nextInputs[cellKey] || '';
        const res = validateCzechAnswer(
          userVal,
          verb,
          tense,
          person,
          session.genders,
          session.futureMode
        );

        if (res.isValid) {
          // Lock the cell with the user's valid form (or canonical form)
          nextLocked[cellKey] = userVal.trim() || res.canonicalAnswer;
          nextInputs[cellKey] = nextLocked[cellKey];
          delete nextFeedback[cellKey];
        } else {
          nextFeedback[cellKey] = {
            status: 'error',
            hint: res.feedbackHint,
          };
          if (!firstWrongCellKey) {
            firstWrongCellKey = { tense, key: cellKey };
          }
        }
      }
    }

    const updatedSession: ActiveTableSession = {
      ...session,
      lockedCells: nextLocked,
    };

    setSession(updatedSession);
    setInputs(nextInputs);
    setCellFeedback(nextFeedback);

    const lockedCountNow = Object.keys(nextLocked).length;

    if (lockedCountNow === 18) {
      // All 3 tenses (18/18) mastered!
      setJustCompletedWord(true);
      const completedProgress = recordTableCompletion(progress, verb.id);
      onUpdateProgress(completedProgress);
      return;
    }

    // Persist partial active session
    onUpdateProgress({
      ...progress,
      updatedAt: new Date().toISOString(),
      stats: {
        ...progress.stats,
        activeSession: updatedSession,
      },
    });

    // If the current mobile tense just reached 6/6, auto-advance mobile tab to next incomplete tense
    const currentTenseLocked = ORDERED_PERSONS.filter((p) =>
      Boolean(nextLocked[`${mobileTense}:${p}`])
    ).length;

    if (currentTenseLocked === 6) {
      const nextIncompleteTense = TENSES.find(
        (t) =>
          ORDERED_PERSONS.filter((p) => Boolean(nextLocked[`${t.key}:${p}`])).length < 6
      );
      if (nextIncompleteTense) {
        setMobileTense(nextIncompleteTense.key);
      }
    } else if (firstWrongCellKey) {
      setMobileTense(firstWrongCellKey.tense);
      setTimeout(() => {
        const el = cellInputRefs.current[firstWrongCellKey!.key];
        if (el) {
          el.focus();
          activeInputRef.current = el;
        }
      }, 40);
    }
  };

  const handleRevealCell = (tense: TenseKey, person: PersonRowKey) => {
    const cellKey = `${tense}:${person}`;
    const expected = getExpectedForms(
      verb,
      tense,
      person,
      session.genders,
      session.futureMode
    )[0];

    setCellFeedback((prev) => ({
      ...prev,
      [cellKey]: {
        status: 'error',
        revealedAnswer: expected,
        hint: `Expected: "${expected}" — type it in to lock the cell!`,
      },
    }));

    setTimeout(() => {
      const el = cellInputRefs.current[cellKey];
      if (el) {
        el.focus();
        activeInputRef.current = el;
      }
    }, 20);
  };

  const handleToggleFutureMode = (nextMode: FutureMode) => {
    if (!verb.forms.futurePf || nextMode === session.futureMode) return;
    // Clear any unlocked/locked future cells if user switches future aspect mode mid-word
    const nextLocked = { ...session.lockedCells };
    const nextInputs = { ...inputs };
    for (const p of ORDERED_PERSONS) {
      delete nextLocked[`future:${p}`];
      delete nextInputs[`future:${p}`];
    }
    const nextSession: ActiveTableSession = {
      ...session,
      futureMode: nextMode,
      lockedCells: nextLocked,
    };
    setSession(nextSession);
    setInputs(nextInputs);
    setJustCompletedWord(false);
  };

  const startNextWord = (rerollSameVerb = false) => {
    const nextSel = rerollSameVerb
      ? selectionInfo
      : selectNextVerbForTable(progress, verb.id);

    const newSession = createTableSessionForVerb(nextSel.verb);
    setSelectionInfo(nextSel);
    setSession(newSession);
    setInputs({});
    setCellFeedback({});
    setMobileTense('past');
    setJustCompletedWord(false);
    setShowMnemonic(false);

    onUpdateProgress({
      ...progress,
      updatedAt: new Date().toISOString(),
      stats: {
        ...progress.stats,
        activeSession: newSession,
      },
    });
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Verb Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {selectionInfo.reason === 'relapsed' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <AlertTriangle className="w-3 h-3" />
                  Re-Queued Priority ({selectionInfo.priorityScore})
                </span>
              ) : selectionInfo.reason === 'new' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Sparkles className="w-3 h-3" />
                  Freq #{verb.frequencyRank} • New Verb
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Flame className="w-3 h-3" />
                  Mastery Review
                </span>
              )}

              <span className="text-xs text-slate-400 font-medium px-2 py-0.5 rounded-md bg-slate-800/80">
                {verb.conjugationClass}
              </span>
              {verb.aspectPairInfinitive && (
                <span className="text-xs text-slate-300 font-medium px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700">
                  Pair: <strong className="text-indigo-300">{verb.aspectPairInfinitive}</strong>
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {verb.infinitive}
              </h2>
              <span className="text-base sm:text-lg font-medium text-slate-300">
                — {verb.english}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 italic">
              “{verb.exampleCz}” <span className="not-italic text-slate-500">({verb.exampleEn})</span>
            </p>
          </div>

          {/* Right actions: Progress pill + Hint toggle + Reroll */}
          <div className="flex items-center gap-2 self-start">
            <button
              type="button"
              onClick={() => setShowMnemonic((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                showMnemonic
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                  : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>Pattern Tip</span>
            </button>

            <button
              type="button"
              onClick={() => startNextWord(true)}
              title="Reset this table with new random genders"
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showMnemonic && (
          <div className="mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-100 leading-relaxed">
            <strong className="text-amber-300">Grammar & Stem Tip:</strong> {verb.mnemonicTip}
          </div>
        )}

        {/* Overall 18-cell mastery bar */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-slate-400">
                3×2 Mastery Progress (Past • Present • Future)
              </span>
              <span className={isAll18Complete ? 'text-emerald-400 font-bold' : 'text-indigo-300'}>
                {totalLocked} / 18 cells locked
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-300 ${
                  isAll18Complete
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : 'bg-gradient-to-r from-indigo-600 to-blue-500'
                }`}
                style={{ width: `${Math.round((totalLocked / 18) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Celebration Banner when all 18/18 cells are correct */}
      {isAll18Complete && (
        <div className="bg-gradient-to-r from-emerald-950/90 via-teal-950/90 to-slate-900 border border-emerald-500/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Výborně! All 18/18 forms of “{verb.infinitive}” mastered!
              </h3>
              <p className="text-xs text-emerald-200/80">
                {justCompletedWord
                  ? 'Saved to your Completed Words pool and cleared from high-priority queue.'
                  : 'All 3 tenses are locked in.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => startNextWord(false)}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer shrink-0"
          >
            <span>Next Word</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile Segmented Tense Switcher (Hidden on lg+ desktop where all 3 show side-by-side) */}
      <div className="lg:hidden grid grid-cols-3 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
        {TENSES.map((t) => {
          const count = getTenseLockedCount(t.key);
          const isComplete = count === 6;
          const isActive = mobileTense === t.key;

          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setMobileTense(t.key)}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : isComplete
                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{t.titleCz.replace(' čas', '')}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isComplete
                    ? 'bg-emerald-500/30 text-emerald-200'
                    : isActive
                    ? 'bg-indigo-800 text-indigo-100'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}/6 {isComplete ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3 Tense Tables (Side-by-side on desktop, active tab on mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {TENSES.map((tenseMeta) => {
          const tense = tenseMeta.key;
          const lockedInTense = getTenseLockedCount(tense);
          const isTenseComplete = lockedInTense === 6;
          const isVisibleOnMobile = mobileTense === tense;

          return (
            <div
              key={tense}
              className={`${
                isVisibleOnMobile ? 'block' : 'hidden lg:block'
              } bg-slate-900/90 border rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between transition-all ${
                isTenseComplete
                  ? 'border-emerald-500/40 shadow-md shadow-emerald-950/20'
                  : 'border-slate-800'
              }`}
            >
              <div>
                {/* Tense Card Header */}
                <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        {tenseMeta.titleCz}
                      </h3>
                      <span className="text-xs text-slate-400">({tenseMeta.titleEn})</span>
                    </div>

                    {/* Explicit Tense Sub-Specification */}
                    {tense === 'past' && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Col 1 targets:{' '}
                        <strong className="text-slate-200">
                          Já ({session.genders.ja === 'm' ? '♂' : '♀'}), Ty (
                          {session.genders.ty === 'm' ? '♂' : '♀'}),{' '}
                          {session.genders.thirdSg.toUpperCase()}
                        </strong>
                      </p>
                    )}

                    {tense === 'present' && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Imperfective present forms of{' '}
                        <strong className="text-slate-200">{verb.infinitive}</strong>
                      </p>
                    )}

                    {tense === 'future' && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {session.futureMode === 'pf' && verb.forms.futurePf ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-500/20 text-purple-200 border border-purple-500/30">
                            Target: Perfective ({verb.aspectPairInfinitive})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-500/20 text-sky-200 border border-sky-500/30">
                            Target: Imperfective (budu + {verb.infinitive})
                          </span>
                        )}

                        {verb.forms.futurePf && (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleFutureMode(
                                session.futureMode === 'impf' ? 'pf' : 'impf'
                              )
                            }
                            className="text-[10px] underline text-slate-400 hover:text-slate-200 cursor-pointer"
                          >
                            Switch to {session.futureMode === 'impf' ? 'Perfective' : 'Imperfective'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                      isTenseComplete
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {lockedInTense}/6
                  </span>
                </div>

                {/* 3x2 Conjugation Grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1 mb-1.5">
                  <div>Col 1 • Singular</div>
                  <div>Col 2 • Plural</div>
                </div>

                <div className="space-y-2.5">
                  {GRID_ROWS.map(([col1Person, col2Person], rowIdx) => (
                    <div key={rowIdx} className="grid grid-cols-2 gap-2.5">
                      {[col1Person, col2Person].map((person) => {
                        const cellKey = `${tense}:${person}`;
                        const isLocked = Boolean(session.lockedCells[cellKey]);
                        const feedback = cellFeedback[cellKey];
                        const labelInfo = formatPersonLabel(person, tense, session.genders);
                        const val = isLocked
                          ? session.lockedCells[cellKey]
                          : inputs[cellKey] ?? '';

                        return (
                          <div
                            key={cellKey}
                            className={`rounded-xl p-2.5 border transition-all flex flex-col justify-between ${
                              isLocked
                                ? 'bg-emerald-950/35 border-emerald-500/40'
                                : feedback?.status === 'error'
                                ? 'bg-rose-950/30 border-rose-500/50'
                                : 'bg-slate-950/80 border-slate-800 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20'
                            }`}
                          >
                            {/* Cell Pronoun Header */}
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-200">
                                  {labelInfo.pronoun}
                                </span>
                                {labelInfo.badge && (
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                      labelInfo.badge.includes('♂')
                                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                        : labelInfo.badge.includes('♀')
                                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                                        : 'bg-slate-700/60 text-slate-300'
                                    }`}
                                  >
                                    {labelInfo.badge}
                                  </span>
                                )}
                              </div>

                              {isLocked ? (
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400">
                                  <Check className="w-3 h-3" />
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  onClick={() => handleRevealCell(tense, person)}
                                  title="Peek answer for this cell"
                                  className="text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                                >
                                  <HelpCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Conjugation Input (16px text-base prevents iOS Safari zoom!) */}
                            <input
                              ref={(el) => {
                                cellInputRefs.current[cellKey] = el;
                              }}
                              type="text"
                              value={val}
                              disabled={isLocked}
                              onFocus={(e) => {
                                activeInputRef.current = e.currentTarget;
                              }}
                              onChange={(e) => handleInputChange(cellKey, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  focusNextUnlockedCell(tense, person, session.lockedCells);
                                }
                              }}
                              placeholder="..."
                              autoCapitalize="none"
                              autoCorrect="off"
                              autoComplete="off"
                              spellCheck={false}
                              enterKeyHint="next"
                              className={`w-full bg-transparent text-base font-semibold outline-none ${
                                isLocked
                                  ? 'text-emerald-300 cursor-default'
                                  : feedback?.status === 'error'
                                  ? 'text-rose-200 placeholder-rose-500/40'
                                  : 'text-white placeholder-slate-600'
                              }`}
                            />

                            {/* Cell Error / Hint Feedback */}
                            {!isLocked && feedback && (
                              <div className="mt-1.5 pt-1 border-t border-rose-500/20 text-[11px] text-rose-300 leading-tight flex items-center justify-between gap-1">
                                <span>
                                  {feedback.hint || 'Try again'}
                                </span>
                                {!feedback.revealedAnswer && (
                                  <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => handleRevealCell(tense, person)}
                                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold underline text-rose-200 hover:text-white shrink-0 cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" /> Show
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-Tense Check Button */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                {isTenseComplete ? (
                  <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{tenseMeta.titleCz} Complete (6/6)</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => validateCells([tense])}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-indigo-600 active:scale-[0.99] text-slate-100 font-semibold text-xs sm:text-sm border border-slate-700 hover:border-indigo-500 transition-all cursor-pointer"
                  >
                    Check {tenseMeta.titleCz} (6 cells)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Action Bar: Check All 3 Tenses at Once or Next Word */}
      {!isAll18Complete && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5">
          <div className="text-xs text-slate-400">
            Correct cells lock in (<span className="text-emerald-400 font-semibold">✅</span>). Keep retrying remaining cells until all 3 tenses (18/18) are right!
          </div>
          <button
            type="button"
            onClick={() => validateCells(['past', 'present', 'future'])}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition-all shrink-0 cursor-pointer"
          >
            Check All 3 Tenses ({18 - totalLocked} remaining)
          </button>
        </div>
      )}
    </div>
  );
};
