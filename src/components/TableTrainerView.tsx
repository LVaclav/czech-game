import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  Lightbulb,
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

const TENSES: { key: TenseKey; titleCz: string; titleEn: string }[] = [
  { key: 'past', titleCz: 'Minulý čas', titleEn: 'Past' },
  { key: 'present', titleCz: 'Přítomný čas', titleEn: 'Present' },
  { key: 'future', titleCz: 'Budoucí čas', titleEn: 'Future' },
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
    <div className="space-y-5 pb-6">
      {/* Editorial Verb Hero Card */}
      <div className="rounded-3xl p-5 sm:p-7 border theme-surface transition-all">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            {/* Top Metadata Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {selectionInfo.reason === 'relapsed' ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: 'var(--warn-bg)',
                    color: 'var(--warn-text)',
                    border: '1px solid var(--warn-border)',
                  }}
                >
                  <AlertTriangle className="w-3 h-3" />
                  Priority Review ({selectionInfo.priorityScore})
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  No. {verb.frequencyRank}
                </span>
              )}

              <span
                className="text-xs font-medium px-2.5 py-0.5 rounded-full border theme-subtle"
                style={{ color: 'var(--text-secondary)' }}
              >
                {verb.conjugationClass}
              </span>

              {verb.aspectPairInfinitive && (
                <span
                  className="text-xs font-medium px-2.5 py-0.5 rounded-full border theme-subtle"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Perfective: <strong style={{ color: 'var(--text-primary)' }}>{verb.aspectPairInfinitive}</strong>
                </span>
              )}
            </div>

            {/* Expressive Verb Infinitive & Translation */}
            <div className="flex items-baseline gap-3.5 flex-wrap pt-0.5">
              <h2
                className="font-display text-4xl sm:text-5xl font-normal tracking-tight leading-none"
                style={{ color: 'var(--text-primary)' }}
              >
                {verb.infinitive}
              </h2>
              <span
                className="text-lg sm:text-xl font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {verb.english}
              </span>
            </div>

            <p className="text-xs sm:text-sm italic pt-0.5" style={{ color: 'var(--text-muted)' }}>
              “{verb.exampleCz}” — <span className="not-italic">{verb.exampleEn}</span>
            </p>
          </div>

          {/* Right Controls: Tip + Reroll + 18-Cell Counter */}
          <div className="flex items-center gap-2 self-start">
            <button
              type="button"
              onClick={() => setShowMnemonic((prev) => !prev)}
              className="px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer theme-subtle"
              style={{
                color: showMnemonic ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderColor: showMnemonic ? 'var(--accent-border)' : 'var(--border-subtle)',
              }}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Grammar Tip</span>
            </button>

            <button
              type="button"
              onClick={() => startNextWord(true)}
              title="Reset table with new random genders"
              className="p-2 rounded-2xl border transition-all cursor-pointer theme-subtle"
              style={{ color: 'var(--text-secondary)' }}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showMnemonic && (
          <div
            className="mt-4 p-3.5 rounded-2xl border text-xs sm:text-sm leading-relaxed"
            style={{
              backgroundColor: 'var(--accent-soft)',
              borderColor: 'var(--accent-border)',
              color: 'var(--text-primary)',
            }}
          >
            <strong>Stem & Pattern Note:</strong> {verb.mnemonicTip}
          </div>
        )}

        {/* Clean Progress Track */}
        <div
          className="mt-5 pt-4 border-t flex items-center justify-between gap-4"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex-1">
            <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider mb-1.5">
              <span style={{ color: 'var(--text-muted)' }}>
                3×2 Mastery (Minulý • Přítomný • Budoucí)
              </span>
              <span
                style={{
                  color: isAll18Complete
                    ? 'var(--success-text)'
                    : 'var(--accent-primary)',
                }}
              >
                {totalLocked} / 18 Locked
              </span>
            </div>
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--bg-subtle)' }}
            >
              <div
                className="h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.round((totalLocked / 18) * 100)}%`,
                  backgroundColor: isAll18Complete
                    ? 'var(--success-text)'
                    : 'var(--accent-primary)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mastery Banner when all 18/18 cells are complete */}
      {isAll18Complete && (
        <div
          className="rounded-3xl p-5 border flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{
            backgroundColor: 'var(--success-bg)',
            borderColor: 'var(--success-border)',
            color: 'var(--success-text)',
          }}
        >
          <div className="flex items-center gap-3.5">
            <CheckCircle2 className="w-7 h-7 shrink-0" />
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                Výborně! All 18 forms of “{verb.infinitive}” mastered.
              </h3>
              <p className="text-xs opacity-85">
                {justCompletedWord
                  ? 'Added to your Vocabulary pool and cleared from high-priority queue.'
                  : 'All 3 tenses are complete.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => startNextWord(false)}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer shrink-0 theme-btn-primary"
          >
            <span>Next Verb</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile Segmented Tense Switcher */}
      <div className="lg:hidden grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl border theme-subtle">
        {TENSES.map((t) => {
          const count = getTenseLockedCount(t.key);
          const isComplete = count === 6;
          const isActive = mobileTense === t.key;

          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setMobileTense(t.key)}
              className="py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              style={
                isActive
                  ? {
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                    }
                  : {
                      color: isComplete
                        ? 'var(--success-text)'
                        : 'var(--text-secondary)',
                    }
              }
            >
              <span>{t.titleCz.replace(' čas', '')}</span>
              <span
                className="text-[10px] px-1.5 py-0.2 rounded-full font-extrabold"
                style={
                  isComplete
                    ? {
                        backgroundColor: 'var(--success-bg)',
                        color: 'var(--success-text)',
                      }
                    : {
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--text-muted)',
                      }
                }
              >
                {count}/6
              </span>
            </button>
          );
        })}
      </div>

      {/* 3 Tense Cards (Side-by-side on desktop, active tense on mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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
              } rounded-3xl p-4 sm:p-5 border flex-col justify-between transition-all theme-surface`}
              style={
                isTenseComplete
                  ? { borderColor: 'var(--success-border)' }
                  : undefined
              }
            >
              <div>
                {/* Tense Header */}
                <div
                  className="flex items-start justify-between gap-2 pb-3.5 mb-3.5 border-b"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <div>
                    <div className="flex items-baseline gap-2">
                      <h3
                        className="font-display text-2xl tracking-tight leading-none"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {tenseMeta.titleCz}
                      </h3>
                      <span
                        className="text-xs font-medium"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {tenseMeta.titleEn}
                      </span>
                    </div>

                    {tense === 'past' && (
                      <p
                        className="text-[11px] mt-1 font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Singular targets:{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>
                          Já ({session.genders.ja === 'm' ? '♂' : '♀'}), Ty (
                          {session.genders.ty === 'm' ? '♂' : '♀'}),{' '}
                          {session.genders.thirdSg.toUpperCase()}
                        </strong>
                      </p>
                    )}

                    {tense === 'present' && (
                      <p
                        className="text-[11px] mt-1 font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Present stem of{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {verb.infinitive}
                        </strong>
                      </p>
                    )}

                    {tense === 'future' && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold"
                          style={{
                            backgroundColor: 'var(--accent-soft)',
                            color: 'var(--accent-primary)',
                          }}
                        >
                          {session.futureMode === 'pf' && verb.forms.futurePf
                            ? `Perfective: ${verb.aspectPairInfinitive}`
                            : `Imperfective: budu + ${verb.infinitive}`}
                        </span>

                        {verb.forms.futurePf && (
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleFutureMode(
                                session.futureMode === 'impf' ? 'pf' : 'impf'
                              )
                            }
                            className="text-[11px] underline cursor-pointer"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Switch
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-bold shrink-0"
                    style={
                      isTenseComplete
                        ? {
                            backgroundColor: 'var(--success-bg)',
                            color: 'var(--success-text)',
                            border: '1px solid var(--success-border)',
                          }
                        : {
                            backgroundColor: 'var(--bg-subtle)',
                            color: 'var(--text-secondary)',
                          }
                    }
                  >
                    {lockedInTense}/6
                  </span>
                </div>

                {/* Column Subheaders */}
                <div
                  className="grid grid-cols-2 gap-2.5 text-[10px] font-bold uppercase tracking-widest px-1 mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <div>Singular (Jednotné)</div>
                  <div>Plural (Množné)</div>
                </div>

                {/* 3×2 Conjugation Matrix */}
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
                            className="rounded-2xl p-2.5 border transition-all flex flex-col justify-between"
                            style={
                              isLocked
                                ? {
                                    backgroundColor: 'var(--success-bg)',
                                    borderColor: 'var(--success-border)',
                                  }
                                : feedback?.status === 'error'
                                ? {
                                    backgroundColor: 'var(--error-bg)',
                                    borderColor: 'var(--error-border)',
                                  }
                                : {
                                    backgroundColor: 'var(--bg-input)',
                                    borderColor: 'var(--border-subtle)',
                                  }
                            }
                          >
                            {/* Pronoun & Gender Badge Row */}
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="text-xs font-bold"
                                  style={{ color: 'var(--text-secondary)' }}
                                >
                                  {labelInfo.pronoun}
                                </span>
                                {labelInfo.badge && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.2 rounded-md"
                                    style={{
                                      backgroundColor: 'var(--bg-subtle)',
                                      color: 'var(--text-primary)',
                                    }}
                                  >
                                    {labelInfo.badge}
                                  </span>
                                )}
                              </div>

                              {isLocked ? (
                                <Check
                                  className="w-3.5 h-3.5"
                                  style={{ color: 'var(--success-text)' }}
                                />
                              ) : (
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  onClick={() => handleRevealCell(tense, person)}
                                  title="Peek expected form"
                                  className="text-[10px] font-semibold opacity-60 hover:opacity-100 cursor-pointer"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Input Field (16px prevents iOS Safari zoom) */}
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
                              placeholder="—"
                              autoCapitalize="none"
                              autoCorrect="off"
                              autoComplete="off"
                              spellCheck={false}
                              enterKeyHint="next"
                              className="w-full bg-transparent text-base font-bold outline-none"
                              style={{
                                color: isLocked
                                  ? 'var(--success-text)'
                                  : feedback?.status === 'error'
                                  ? 'var(--error-text)'
                                  : 'var(--text-primary)',
                              }}
                            />

                            {/* Subtle Inline Hint when Wrong or Peeked */}
                            {!isLocked && feedback && (
                              <div
                                className="mt-1 pt-1 border-t text-[11px] font-medium leading-tight flex items-center justify-between gap-1"
                                style={{
                                  borderColor: 'var(--error-border)',
                                  color: 'var(--error-text)',
                                }}
                              >
                                <span className="truncate">
                                  {feedback.hint || 'Try again'}
                                </span>
                                {!feedback.revealedAnswer && (
                                  <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => handleRevealCell(tense, person)}
                                    className="text-[10px] font-bold underline shrink-0 cursor-pointer"
                                  >
                                    Peek
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
              <div
                className="mt-4 pt-3.5 border-t"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                {isTenseComplete ? (
                  <div
                    className="w-full py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5"
                    style={{
                      backgroundColor: 'var(--success-bg)',
                      color: 'var(--success-text)',
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{tenseMeta.titleCz} Complete</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => validateCells([tense])}
                    className="w-full py-2.5 px-4 rounded-2xl font-bold text-xs sm:text-sm border transition-all cursor-pointer theme-subtle"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Check {tenseMeta.titleCz}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Action Bar: Check All 3 Tenses */}
      {!isAll18Complete && (
        <div className="rounded-3xl p-4 border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 theme-surface">
          <div className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
            Correct answers lock in automatically. Keep going until all 18 cells are complete.
          </div>
          <button
            type="button"
            onClick={() => validateCells(['past', 'present', 'future'])}
            className="px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition-all shrink-0 cursor-pointer theme-btn-primary"
          >
            Check All 3 Tenses ({18 - totalLocked} left)
          </button>
        </div>
      )}
    </div>
  );
};
