import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  ActiveTableSession,
  CefrLevel,
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

const LEVEL_LABELS: Record<CefrLevel, string> = {
  A1: 'A1 Basic',
  A2: 'A2 Elementary',
  B1: 'B1 Intermediate',
  B2: 'B2 Advanced',
};

const TENSES: { key: TenseKey; titleCz: string; shortCz: string; titleEn: string }[] = [
  { key: 'past', titleCz: 'Minulý čas', shortCz: 'Minulý', titleEn: 'Past Tense' },
  { key: 'present', titleCz: 'Přítomný čas', shortCz: 'Přítomný', titleEn: 'Present Tense' },
  { key: 'future', titleCz: 'Budoucí čas', shortCz: 'Budoucí', titleEn: 'Future Tense' },
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
  const [isSentenceRevealed, setIsSentenceRevealed] = useState(false);
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
      setMobileTense('past');
      setIsSentenceRevealed(false);
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

  const startNextWord = () => {
    const nextSel = selectNextVerbForTable(progress, verb.id);

    const newSession = createTableSessionForVerb(nextSel.verb);
    setSelectionInfo(nextSel);
    setSession(newSession);
    setInputs({});
    setCellFeedback({});
    setMobileTense('past');
    setJustCompletedWord(false);
    setIsSentenceRevealed(false);

    onUpdateProgress({
      ...progress,
      updatedAt: new Date().toISOString(),
      stats: {
        ...progress.stats,
        activeSession: newSession,
      },
    });
  };

  const levelBadge = verb.level ? LEVEL_LABELS[verb.level] : 'A1 Basic';

  return (
    <div className="space-y-4">
      {/* 1. Spacious Verb Header Card (Styled with iOS 26 Translate #18181B surface & Cyan accents) */}
      <div className="tr-card p-5 sm:p-6">
        <div className="space-y-2.5">
          {/* Metadata Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {selectionInfo.reason === 'relapsed' ? (
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: 'var(--tr-orange-soft)',
                  color: 'var(--tr-orange)',
                }}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Re-Queued Priority ({selectionInfo.priorityScore})
              </span>
            ) : (
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: 'var(--tr-cyan-soft)',
                  color: 'var(--tr-cyan)',
                }}
              >
                {levelBadge} • #{verb.frequencyRank}
              </span>
            )}

            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/8 text-[#8E8E93]">
              {verb.conjugationClass}
            </span>

            {verb.aspectPairInfinitive && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/8 text-white">
                Pair:{' '}
                <strong style={{ color: 'var(--tr-cyan)' }}>
                  {verb.aspectPairInfinitive}
                </strong>
              </span>
            )}
          </div>

          {/* Czech Verb + Glowing Cyan English Translation */}
          <div className="flex items-baseline gap-3.5 flex-wrap pt-0.5">
            <h2 className="font-display text-3xl sm:text-4xl text-white tracking-tight">
              {verb.infinitive}
            </h2>
            <span
              className="font-display text-2xl sm:text-3xl"
              style={{ color: 'var(--tr-cyan)' }}
            >
              — {verb.english}
            </span>
          </div>

          {/* Example Sentence: Blurred by default, tap to reveal/hide */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsSentenceRevealed((prev) => !prev)}
              className="group relative inline-flex items-center gap-2.5 text-left px-3.5 py-2 rounded-2xl bg-black/55 border border-white/8 hover:border-white/15 transition-all cursor-pointer max-w-full"
              title={
                isSentenceRevealed
                  ? 'Tap to blur example sentence'
                  : 'Tap to reveal example sentence'
              }
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93] shrink-0 flex items-center gap-1">
                {isSentenceRevealed ? (
                  <EyeOff
                    className="w-3.5 h-3.5"
                    style={{ color: 'var(--tr-cyan)' }}
                  />
                ) : (
                  <Eye
                    className="w-3.5 h-3.5"
                    style={{ color: 'var(--tr-cyan)' }}
                  />
                )}
                <span>Example:</span>
              </span>

              <span
                className={`text-xs sm:text-sm text-[#D1D1D6] transition-all duration-200 ${
                  isSentenceRevealed
                    ? 'blur-none select-text'
                    : 'blur-[5px] select-none opacity-80'
                }`}
              >
                “{verb.exampleCz}”{' '}
                <span className="text-[#8E8E93]">({verb.exampleEn})</span>
              </span>

              {!isSentenceRevealed && (
                <span
                  className="text-[11px] font-semibold shrink-0 ml-1"
                  style={{ color: 'var(--tr-cyan)' }}
                >
                  Tap to reveal
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Celebration Banner when all 18/18 cells are complete */}
      {isAll18Complete && (
        <div
          className="tr-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{
            border: '1px solid var(--tr-green)',
          }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--tr-green-soft)',
                color: 'var(--tr-green)',
              }}
            >
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Výborně! All 18/18 forms of “{verb.infinitive}” mastered!
              </h3>
              <p className="text-xs text-[#8E8E93]">
                {justCompletedWord
                  ? 'Saved to your Vocabulary pool and cleared from high-priority queue.'
                  : 'All 3 tenses are locked in.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => startNextWord()}
            className="w-full sm:w-auto px-6 py-3 text-sm flex items-center justify-center gap-2 cursor-pointer shrink-0 tr-btn-cyan"
          >
            <span>Next Word</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Mobile Tense Switcher Capsule (Hidden on lg+ desktop where all 3 show side-by-side) */}
      <div className="lg:hidden h-[52px] p-[4px] rounded-full grid grid-cols-3 items-center tr-bottom-dock-glass">
        {TENSES.map((t) => {
          const count = getTenseLockedCount(t.key);
          const isComplete = count === 6;
          const isActive = mobileTense === t.key;

          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setMobileTense(t.key)}
              className={`h-full rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isActive ? 'tr-bottom-tab-active' : ''
              }`}
              style={{
                color: isActive
                  ? 'var(--tr-cyan)'
                  : isComplete
                  ? 'var(--tr-green)'
                  : '#ffffff',
              }}
            >
              <span>{t.shortCz}</span>
              <span
                className="text-[11px] tabular-nums"
                style={{
                  color: isComplete
                    ? 'var(--tr-green)'
                    : isActive
                    ? 'var(--tr-cyan)'
                    : '#8E8E93',
                }}
              >
                {isComplete ? '✓' : `${count}/6`}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Three 3×2 Tense Cards (Side-by-side on desktop, active tense on mobile) */}
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
                isVisibleOnMobile ? 'flex' : 'hidden lg:flex'
              } tr-card p-5 flex-col justify-between transition-all`}
            >
              <div>
                {/* Tense Card Header */}
                <div className="flex items-start justify-between gap-2 pb-3.5 mb-3.5 tr-hairline-b">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-lg font-bold text-white tracking-tight">
                        {tenseMeta.titleCz}
                      </h3>
                      <span className="text-xs text-[#8E8E93]">
                        {tenseMeta.titleEn}
                      </span>
                    </div>

                    {tense === 'past' && (
                      <p className="text-xs text-[#8E8E93] mt-1">
                        Col 1 targets:{' '}
                        <strong style={{ color: 'var(--tr-cyan)' }}>
                          Já ({session.genders.ja === 'm' ? '♂' : '♀'}), Ty (
                          {session.genders.ty === 'm' ? '♂' : '♀'}),{' '}
                          {session.genders.thirdSg.toUpperCase()}
                        </strong>
                      </p>
                    )}

                    {tense === 'present' && (
                      <p className="text-xs text-[#8E8E93] mt-1">
                        Imperfective present of{' '}
                        <strong className="text-white">{verb.infinitive}</strong>
                      </p>
                    )}

                    {tense === 'future' && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                          style={{
                            backgroundColor: 'var(--tr-cyan-soft)',
                            color: 'var(--tr-cyan)',
                          }}
                        >
                          {session.futureMode === 'pf' && verb.forms.futurePf
                            ? `Perfective (${verb.aspectPairInfinitive})`
                            : `Imperfective (budu + ${verb.infinitive})`}
                        </span>

                        {verb.forms.futurePf && (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleFutureMode(
                                session.futureMode === 'impf' ? 'pf' : 'impf'
                              )
                            }
                            className="text-[11px] underline text-[#8E8E93] hover:text-white cursor-pointer"
                          >
                            Switch
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-bold tabular-nums shrink-0"
                    style={
                      isTenseComplete
                        ? {
                            backgroundColor: 'var(--tr-green-soft)',
                            color: 'var(--tr-green)',
                          }
                        : {
                            backgroundColor: '#000000',
                            color: '#8E8E93',
                          }
                    }
                  >
                    {lockedInTense}/6
                  </span>
                </div>

                {/* Column Headers */}
                <div className="grid grid-cols-2 gap-2.5 text-[11px] font-bold uppercase tracking-wider text-[#8E8E93] px-1 mb-2">
                  <div>Col 1 • Singular</div>
                  <div>Col 2 • Plural</div>
                </div>

                {/* 3×2 Conjugation Cells */}
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
                            onClick={() => {
                              if (!isLocked) {
                                cellInputRefs.current[cellKey]?.focus();
                              }
                            }}
                            className="rounded-[20px] p-3 transition-all flex flex-col justify-between cursor-text border"
                            style={
                              isLocked
                                ? {
                                    backgroundColor: 'var(--tr-green-soft)',
                                    borderColor: 'rgba(48, 209, 88, 0.4)',
                                  }
                                : feedback?.status === 'error'
                                ? {
                                    backgroundColor: 'var(--tr-red-soft)',
                                    borderColor: 'rgba(255, 69, 58, 0.45)',
                                  }
                                : {
                                    backgroundColor: '#000000',
                                    borderColor: 'rgba(255, 255, 255, 0.08)',
                                  }
                            }
                          >
                            {/* Pronoun & Gender Badge */}
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white">
                                  {labelInfo.pronoun}
                                </span>
                                {labelInfo.badge && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.2 rounded-md"
                                    style={{
                                      backgroundColor: 'var(--tr-cyan-soft)',
                                      color: 'var(--tr-cyan)',
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
                                    backgroundColor: 'var(--tr-green)',
                                    color: '#000000',
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
                                    handleRevealCell(tense, person);
                                  }}
                                  title="Peek answer"
                                  className="text-[#545458] hover:text-white p-0.5 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Input Field (16px+ prevents iOS Safari zoom) */}
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
                              placeholder="Type..."
                              autoCapitalize="none"
                              autoCorrect="off"
                              autoComplete="off"
                              spellCheck={false}
                              enterKeyHint="next"
                              className="w-full bg-transparent text-[17px] font-bold tracking-tight outline-none placeholder-[#48484C]"
                              style={{
                                color: isLocked
                                  ? 'var(--tr-green)'
                                  : feedback?.status === 'error'
                                  ? 'var(--tr-red)'
                                  : 'var(--tr-cyan)',
                              }}
                            />

                            {/* Cell Error / Hint */}
                            {!isLocked && feedback && (
                              <div
                                className="mt-1.5 pt-1 text-[11px] font-medium leading-tight flex items-center justify-between gap-1 tr-hairline-t"
                                style={{ color: 'var(--tr-red)' }}
                              >
                                <span className="truncate">
                                  {feedback.hint || 'Try again'}
                                </span>
                                {!feedback.revealedAnswer && (
                                  <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRevealCell(tense, person);
                                    }}
                                    className="text-[10px] font-bold underline shrink-0 cursor-pointer"
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
              </div>

              {/* Per-Tense Check Button */}
              <div className="mt-4 pt-3.5 tr-hairline-t">
                {isTenseComplete ? (
                  <div
                    className="w-full py-2.5 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-1.5"
                    style={{
                      backgroundColor: 'var(--tr-green-soft)',
                      color: 'var(--tr-green)',
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{tenseMeta.titleCz} Complete (6/6)</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => validateCells([tense])}
                    className="w-full py-3 px-4 rounded-full text-xs sm:text-sm font-bold cursor-pointer tr-btn-cyan"
                  >
                    Check {tenseMeta.titleCz} (6 cells)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
