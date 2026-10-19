import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  Info,
  RotateCcw,
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

const TENSES: { key: TenseKey; titleCz: string; shortCz: string; titleEn: string }[] = [
  { key: 'past', titleCz: 'Minulý čas', shortCz: 'Minulý', titleEn: 'Past' },
  { key: 'present', titleCz: 'Přítomný čas', shortCz: 'Přítomný', titleEn: 'Present' },
  { key: 'future', titleCz: 'Budoucí čas', shortCz: 'Budoucí', titleEn: 'Future' },
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
  const [activeTense, setActiveTense] = useState<TenseKey>('past');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [justCompletedWord, setJustCompletedWord] = useState(false);

  const cellInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const verb: VerbEntry = VERB_MAP[session.verbId] || selectionInfo.verb;
  const totalLocked = Object.keys(session.lockedCells).length;
  const isAll18Complete = totalLocked === 18;

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
      setActiveTense('past');
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
          setActiveTense(candidate.tense);
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
      setJustCompletedWord(true);
      const completedProgress = recordTableCompletion(progress, verb.id);
      onUpdateProgress(completedProgress);
      return;
    }

    onUpdateProgress({
      ...progress,
      updatedAt: new Date().toISOString(),
      stats: {
        ...progress.stats,
        activeSession: updatedSession,
      },
    });

    const currentTenseLocked = ORDERED_PERSONS.filter((p) =>
      Boolean(nextLocked[`${activeTense}:${p}`])
    ).length;

    if (currentTenseLocked === 6) {
      const nextIncompleteTense = TENSES.find(
        (t) =>
          ORDERED_PERSONS.filter((p) => Boolean(nextLocked[`${t.key}:${p}`])).length < 6
      );
      if (nextIncompleteTense) {
        setActiveTense(nextIncompleteTense.key);
      }
    } else if (firstWrongCellKey) {
      setActiveTense(firstWrongCellKey.tense);
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
        hint: expected,
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
    setActiveTense('past');
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

  const activeTenseMeta = TENSES.find((t) => t.key === activeTense) || TENSES[0];
  const lockedInActiveTense = getTenseLockedCount(activeTense);
  const isActiveTenseComplete = lockedInActiveTense === 6;

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-6">
      {/* Apple Translate Split Source/Target Card */}
      <div className="ios-card overflow-hidden">
        {/* Top Pane: CZECH (Source) */}
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span
                className="text-[12px] font-semibold uppercase tracking-wide"
                style={{ color: 'var(--ios-label-secondary)' }}
              >
                Czech
              </span>
              {selectionInfo.reason === 'relapsed' && (
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'var(--ios-orange-bg)',
                    color: 'var(--ios-orange-text)',
                  }}
                >
                  Priority Review
                </span>
              )}
            </div>

            <span
              className="text-[12px] font-medium"
              style={{ color: 'var(--ios-label-secondary)' }}
            >
              {verb.conjugationClass}
              {verb.aspectPairInfinitive ? ` • pf. ${verb.aspectPairInfinitive}` : ''}
            </span>
          </div>

          <div className="font-display text-[30px] sm:text-[34px] leading-tight">
            {verb.infinitive}
          </div>

          <p
            className="text-[14px] mt-1 leading-snug"
            style={{ color: 'var(--ios-label-secondary)' }}
          >
            {verb.exampleCz}
          </p>
        </div>

        {/* Hairline 0.5px Divider (Exact Apple Translate Card Split) */}
        <div className="mx-4 ios-hairline-t" />

        {/* Bottom Pane: ENGLISH (Target in Apple System Blue) */}
        <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
          <div>
            <div
              className="text-[12px] font-semibold uppercase tracking-wide mb-0.5"
              style={{ color: 'var(--ios-blue)' }}
            >
              English
            </div>
            <div
              className="font-display text-[24px] sm:text-[26px] leading-tight"
              style={{ color: 'var(--ios-blue)' }}
            >
              {verb.english}
            </div>
            <p
              className="text-[13px] mt-0.5"
              style={{ color: 'var(--ios-label-secondary)' }}
            >
              {verb.exampleEn}
            </p>
          </div>

          {/* Right Circular Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowMnemonic((prev) => !prev)}
              title="Grammar Note"
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-opacity active:opacity-60"
              style={{
                backgroundColor: 'var(--ios-fill)',
                color: 'var(--ios-blue)',
              }}
            >
              <Info className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => startNextWord(true)}
              title="Randomize genders"
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-opacity active:opacity-60"
              style={{
                backgroundColor: 'var(--ios-fill)',
                color: 'var(--ios-blue)',
              }}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Grammar Note Drawer */}
        {showMnemonic && (
          <div
            className="px-4 py-3 text-[13px] leading-relaxed ios-hairline-t"
            style={{
              backgroundColor: 'var(--ios-fill)',
              color: 'var(--ios-label)',
            }}
          >
            <strong style={{ color: 'var(--ios-blue)' }}>Grammar Note:</strong>{' '}
            {verb.mnemonicTip}
          </div>
        )}
      </div>

      {/* Completion Banner when all 18/18 cells are complete */}
      {isAll18Complete && (
        <div
          className="ios-card p-4 flex items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--ios-green-bg)',
            border: '0.5px solid var(--ios-green)',
          }}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2
              className="w-6 h-6 shrink-0"
              style={{ color: 'var(--ios-green)' }}
            />
            <div>
              <div
                className="text-[15px] font-semibold"
                style={{ color: 'var(--ios-label)' }}
              >
                All 18 Forms Mastered
              </div>
              <div
                className="text-[13px]"
                style={{ color: 'var(--ios-label-secondary)' }}
              >
                {justCompletedWord
                  ? 'Added to Favorites / Completed list'
                  : 'Past, Present, and Future complete'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => startNextWord(false)}
            className="px-4 py-2 text-[14px] flex items-center gap-1.5 cursor-pointer shrink-0 ios-btn-blue"
          >
            <span>Next</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Native iOS UISegmentedControl (Past • Present • Future) */}
      <div className="grid grid-cols-3 ios-segmented">
        {TENSES.map((t) => {
          const count = getTenseLockedCount(t.key);
          const isComplete = count === 6;
          const isActive = activeTense === t.key;

          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTense(t.key)}
              className={`py-1.5 px-2 text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isActive ? 'ios-segmented-active' : ''
              }`}
              style={{
                color: isActive
                  ? 'var(--ios-label)'
                  : 'var(--ios-label-secondary)',
              }}
            >
              <span>{t.shortCz}</span>
              <span
                className="text-[11px] tabular-nums font-semibold"
                style={{
                  color: isComplete
                    ? 'var(--ios-green)'
                    : isActive
                    ? 'var(--ios-blue)'
                    : 'var(--ios-label-tertiary)',
                }}
              >
                {isComplete ? '✓' : `${count}/6`}
              </span>
            </button>
          );
        })}
      </div>

      {/* iOS Inset Grouped Section Header */}
      <div className="flex items-center justify-between px-4 pt-1">
        <div
          className="text-[12px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--ios-label-secondary)' }}
        >
          {activeTenseMeta.titleCz} ({activeTenseMeta.titleEn})
          {activeTense === 'future' && (
            <span className="ml-1.5 normal-case font-medium">
              •{' '}
              {session.futureMode === 'pf' && verb.forms.futurePf
                ? `pf. ${verb.aspectPairInfinitive}`
                : `budu + ${verb.infinitive}`}
            </span>
          )}
        </div>

        {activeTense === 'future' && verb.forms.futurePf ? (
          <button
            type="button"
            onClick={() =>
              handleToggleFutureMode(session.futureMode === 'impf' ? 'pf' : 'impf')
            }
            className="text-[12px] font-medium cursor-pointer"
            style={{ color: 'var(--ios-blue)' }}
          >
            Switch Aspect
          </button>
        ) : (
          <span
            className="text-[12px] tabular-nums"
            style={{ color: 'var(--ios-label-secondary)' }}
          >
            {totalLocked}/18 total
          </span>
        )}
      </div>

      {/* Native iOS Inset Grouped 3×2 Conjugation Table */}
      <div className="ios-card overflow-hidden">
        {/* Column Subheaders */}
        <div
          className="grid grid-cols-2 text-[11px] font-semibold uppercase tracking-wider ios-hairline-b"
          style={{ color: 'var(--ios-label-secondary)' }}
        >
          <div className="px-4 py-2 ios-hairline-r">Singular</div>
          <div className="px-4 py-2">Plural</div>
        </div>

        {/* 3 Rows × 2 Columns */}
        {GRID_ROWS.map(([col1Person, col2Person], rowIdx) => (
          <div
            key={rowIdx}
            className={`grid grid-cols-2 ${rowIdx < 2 ? 'ios-hairline-b' : ''}`}
          >
            {[col1Person, col2Person].map((person, colIdx) => {
              const cellKey = `${activeTense}:${person}`;
              const isLocked = Boolean(session.lockedCells[cellKey]);
              const feedback = cellFeedback[cellKey];
              const labelInfo = formatPersonLabel(person, activeTense, session.genders);
              const val = isLocked
                ? session.lockedCells[cellKey]
                : inputs[cellKey] ?? '';

              return (
                <div
                  key={cellKey}
                  onClick={() => {
                    if (!isLocked) {
                      cellInputRefs.current[cellKey]?.focus();
                    }
                  }}
                  className={`px-4 py-3 flex flex-col justify-between cursor-text transition-colors ${
                    colIdx === 0 ? 'ios-hairline-r' : ''
                  }`}
                  style={
                    isLocked
                      ? { backgroundColor: 'var(--ios-green-bg)' }
                      : feedback?.status === 'error'
                      ? { backgroundColor: 'var(--ios-red-bg)' }
                      : undefined
                  }
                >
                  {/* Pronoun & Gender Badge */}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[13px] font-medium"
                        style={{ color: 'var(--ios-label-secondary)' }}
                      >
                        {labelInfo.pronoun}
                      </span>
                      {labelInfo.badge && (
                        <span
                          className="text-[11px] font-semibold px-1.5 py-0.2 rounded-md"
                          style={{
                            backgroundColor: 'var(--ios-fill)',
                            color: 'var(--ios-label)',
                          }}
                        >
                          {labelInfo.badge}
                        </span>
                      )}
                    </div>

                    {isLocked ? (
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: 'var(--ios-green)',
                          color: '#ffffff',
                        }}
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    ) : (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRevealCell(activeTense, person);
                        }}
                        title="Reveal form"
                        className="p-0.5 cursor-pointer"
                        style={{ color: 'var(--ios-label-tertiary)' }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Native iOS Inline Text Input */}
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
                        focusNextUnlockedCell(activeTense, person, session.lockedCells);
                      }
                    }}
                    placeholder="Conjugate"
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    className="w-full bg-transparent text-[17px] font-semibold tracking-tight outline-none"
                    style={{
                      color: isLocked
                        ? 'var(--ios-green-text)'
                        : feedback?.status === 'error'
                        ? 'var(--ios-red-text)'
                        : 'var(--ios-label)',
                    }}
                  />

                  {/* Error / Revealed Feedback */}
                  {!isLocked && feedback && (
                    <div
                      className="mt-1 pt-1 text-[11px] font-medium leading-tight flex items-center justify-between gap-1 ios-hairline-t"
                      style={{ color: 'var(--ios-red-text)' }}
                    >
                      <span className="truncate">{feedback.hint || 'Incorrect'}</span>
                      {!feedback.revealedAnswer && (
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRevealCell(activeTense, person);
                          }}
                          className="text-[11px] font-semibold underline shrink-0 cursor-pointer"
                        >
                          Show
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

      {/* Primary iOS Action Button */}
      <div className="space-y-2 pt-1">
        {isActiveTenseComplete ? (
          <div
            className="w-full py-3.5 px-4 rounded-[14px] text-[15px] font-semibold flex items-center justify-center gap-2"
            style={{
              backgroundColor: 'var(--ios-green-bg)',
              color: 'var(--ios-green-text)',
            }}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{activeTenseMeta.titleCz} Complete (6/6)</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => validateCells([activeTense])}
            className="w-full py-3.5 px-5 text-[16px] cursor-pointer ios-btn-blue"
          >
            Check {activeTenseMeta.titleCz}
          </button>
        )}

        {!isAll18Complete && totalLocked > 0 && (
          <button
            type="button"
            onClick={() => validateCells(['past', 'present', 'future'])}
            className="w-full py-3 px-4 text-[14px] cursor-pointer ios-btn-secondary"
          >
            Check All 3 Tenses ({18 - totalLocked} remaining)
          </button>
        )}
      </div>
    </div>
  );
};
