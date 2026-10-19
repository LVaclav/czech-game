import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { TenseKey, UserProgressBlob } from '../types';
import {
  FlashcardPrompt,
  generateFlashcardPrompt,
  recordFlashcardAttempt,
  VERB_MAP,
} from '../lib/priorityQueue';
import {
  formatPersonLabel,
  ValidationResult,
  validateCzechAnswer,
} from '../lib/validator';

interface FlashcardViewProps {
  progress: UserProgressBlob;
  onUpdateProgress: (next: UserProgressBlob) => void;
  onSwitchToTableTrainer: (verbId?: string) => void;
  activeInputRef: React.MutableRefObject<HTMLInputElement | null>;
}

const TENSE_LABELS: Record<TenseKey, { cz: string; en: string }> = {
  past: { cz: 'Minulý čas', en: 'Past Tense' },
  present: { cz: 'Přítomný čas', en: 'Present Tense' },
  future: { cz: 'Budoucí čas', en: 'Future Tense' },
};

export const FlashcardView: React.FC<FlashcardViewProps> = ({
  progress,
  onUpdateProgress,
  onSwitchToTableTrainer,
  activeInputRef,
}) => {
  const [prompt, setPrompt] = useState<FlashcardPrompt | null>(() =>
    generateFlashcardPrompt(progress)
  );
  const [answer, setAnswer] = useState('');
  const [grading, setGrading] = useState<{
    result: ValidationResult;
    userTyped: string;
    relapsedNow: boolean;
    overriddenAsCorrect: boolean;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const completedCount = Object.values(progress.verbs).filter(
    (v) => v.completed && VERB_MAP[v.verbId]
  ).length;

  useEffect(() => {
    if (!prompt && completedCount > 0) {
      setPrompt(generateFlashcardPrompt(progress));
    }
  }, [completedCount, progress, prompt]);

  useEffect(() => {
    if (prompt && !grading && inputRef.current) {
      inputRef.current.focus();
      activeInputRef.current = inputRef.current;
    }
  }, [prompt, grading, activeInputRef]);

  if (completedCount === 0 || !prompt) {
    return (
      <div className="rounded-3xl p-8 sm:p-10 text-center max-w-lg mx-auto my-6 border theme-surface space-y-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
          style={{
            backgroundColor: 'var(--accent-soft)',
            color: 'var(--accent-primary)',
          }}
        >
          <BookOpen className="w-6 h-6" />
        </div>
        <h2
          className="font-display text-3xl font-normal"
          style={{ color: 'var(--text-primary)' }}
        >
          No Completed Verbs Yet
        </h2>
        <p
          className="text-sm leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          Flashcards pull exclusively from verbs you have mastered in the{' '}
          <strong>3×2 Matrix Trainer</strong>. Finish your first verb across Past, Present, and Future to unlock Flashcard drills!
        </p>
        <button
          type="button"
          onClick={() => onSwitchToTableTrainer()}
          className="px-6 py-3 rounded-2xl font-bold text-sm inline-flex items-center gap-2 shadow-md cursor-pointer theme-btn-primary"
        >
          <Sparkles className="w-4 h-4" />
          <span>Open 3×2 Matrix Trainer</span>
        </button>
      </div>
    );
  }

  const verbRecord = progress.verbs[prompt.verb.id];
  const personInfo = formatPersonLabel(prompt.person, prompt.tense, prompt.genders);
  const tenseInfo = TENSE_LABELS[prompt.tense];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (grading) {
      handleNextCard();
      return;
    }

    const validation = validateCzechAnswer(
      answer,
      prompt.verb,
      prompt.tense,
      prompt.person,
      prompt.genders,
      prompt.futureMode
    );

    const { updatedProgress, triggeredRelapse } = recordFlashcardAttempt(
      progress,
      prompt.verb.id,
      prompt.promptKey,
      validation.isValid
    );

    onUpdateProgress(updatedProgress);
    setGrading({
      result: validation,
      userTyped: answer.trim(),
      relapsedNow: triggeredRelapse,
      overriddenAsCorrect: false,
    });
  };

  const handleOverrideTypo = () => {
    if (!grading || grading.result.isValid || grading.overriddenAsCorrect) return;

    const existing = progress.verbs[prompt.verb.id];
    if (!existing) return;

    const prevFc = existing.flashcards;
    const correctedLast5 = [...prevFc.last5Results.slice(0, -1), true];
    const updatedProgress: UserProgressBlob = {
      ...progress,
      updatedAt: new Date().toISOString(),
      verbs: {
        ...progress.verbs,
        [prompt.verb.id]: {
          ...existing,
          inMatrixQueue: grading.relapsedNow ? false : existing.inMatrixQueue,
          priorityScore: grading.relapsedNow ? 10 : existing.priorityScore,
          flashcards: {
            ...prevFc,
            totalCorrect: prevFc.totalCorrect + 1,
            consecutiveWrong: 0,
            last5Results: correctedLast5,
          },
        },
      },
    };

    onUpdateProgress(updatedProgress);
    setGrading({
      ...grading,
      overriddenAsCorrect: true,
      relapsedNow: false,
    });
  };

  const handleNextCard = () => {
    const next = generateFlashcardPrompt(progress, prompt.verb.id);
    setPrompt(next);
    setAnswer('');
    setGrading(null);
  };

  const attempts = verbRecord?.flashcards.totalAttempts || 0;
  const accuracy =
    attempts > 0
      ? Math.round(((verbRecord?.flashcards.totalCorrect || 0) / attempts) * 100)
      : 100;

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-6">
      {/* Pool Status Row */}
      <div
        className="flex items-center justify-between text-xs px-2 font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span>
          Pool: <strong style={{ color: 'var(--text-primary)' }}>{completedCount}</strong> mastered{' '}
          {completedCount === 1 ? 'verb' : 'verbs'}
        </span>
        <div className="flex items-center gap-2">
          <span>
            Accuracy: <strong style={{ color: 'var(--text-primary)' }}>{accuracy}%</strong>
          </span>
          {verbRecord?.inMatrixQueue && (
            <span
              className="px-2 py-0.5 rounded-full font-bold text-[11px]"
              style={{
                backgroundColor: 'var(--warn-bg)',
                color: 'var(--warn-text)',
                border: '1px solid var(--warn-border)',
              }}
            >
              Re-Queued in Matrix
            </span>
          )}
        </div>
      </div>

      {/* Tactile Editorial Flashcard */}
      <div className="rounded-3xl p-6 sm:p-8 border theme-surface space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent-primary)',
            }}
          >
            {tenseInfo.cz} • {tenseInfo.en}
          </span>

          {prompt.tense === 'future' && (
            <span
              className="px-2.5 py-1 rounded-full text-xs font-semibold border theme-subtle"
              style={{ color: 'var(--text-secondary)' }}
            >
              {prompt.futureMode === 'pf' && prompt.verb.forms.futurePf
                ? `Perfective (${prompt.verb.aspectPairInfinitive})`
                : `Imperfective (budu + ${prompt.verb.infinitive})`}
            </span>
          )}
        </div>

        {/* Center Verb & Person Target */}
        <div className="text-center py-3 space-y-4">
          <div>
            <div
              className="font-display text-5xl sm:text-6xl font-normal tracking-tight leading-none"
              style={{ color: 'var(--text-primary)' }}
            >
              {prompt.tense === 'future' &&
              prompt.futureMode === 'pf' &&
              prompt.verb.aspectPairInfinitive
                ? prompt.verb.aspectPairInfinitive
                : prompt.verb.infinitive}
            </div>
            <div
              className="text-base sm:text-lg font-medium mt-2"
              style={{ color: 'var(--text-secondary)' }}
            >
              “{prompt.verb.english}”
            </div>
          </div>

          <div
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl border theme-subtle"
          >
            <span
              className="text-xs uppercase tracking-widest font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              Who
            </span>
            <span
              className="text-xl font-extrabold"
              style={{ color: 'var(--accent-primary)' }}
            >
              {personInfo.pronoun}
            </span>
            {personInfo.badge && (
              <span
                className="px-2 py-0.5 rounded-lg text-xs font-bold"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                }}
              >
                {personInfo.badge}
              </span>
            )}
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              ({personInfo.subtitle})
            </span>
          </div>
        </div>

        {/* Answer Input & Grading */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={answer}
            readOnly={Boolean(grading)}
            onFocus={(e) => {
              activeInputRef.current = e.currentTarget;
            }}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={`Conjugate for ${personInfo.pronoun}...`}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            className="w-full px-4 py-4 rounded-2xl border text-center text-base sm:text-lg font-bold outline-none transition-all"
            style={
              !grading
                ? {
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-primary)',
                  }
                : grading.result.isValid || grading.overriddenAsCorrect
                ? {
                    backgroundColor: 'var(--success-bg)',
                    borderColor: 'var(--success-border)',
                    color: 'var(--success-text)',
                  }
                : {
                    backgroundColor: 'var(--error-bg)',
                    borderColor: 'var(--error-border)',
                    color: 'var(--error-text)',
                  }
            }
          />

          {!grading ? (
            <button
              type="submit"
              className="w-full py-3.5 px-5 rounded-2xl font-bold text-base shadow-md transition-all cursor-pointer theme-btn-primary"
            >
              Check Answer
            </button>
          ) : (
            <div className="space-y-3">
              {grading.result.isValid || grading.overriddenAsCorrect ? (
                <div
                  className="p-4 rounded-2xl border flex items-center gap-3"
                  style={{
                    backgroundColor: 'var(--success-bg)',
                    borderColor: 'var(--success-border)',
                    color: 'var(--success-text)',
                  }}
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <div className="text-sm font-bold">
                    Správně! Canonical: <u>{grading.result.canonicalAnswer}</u>
                  </div>
                </div>
              ) : (
                <div
                  className="p-4 rounded-2xl border space-y-3"
                  style={{
                    backgroundColor: 'var(--error-bg)',
                    borderColor: 'var(--error-border)',
                    color: 'var(--error-text)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-bold">
                          Expected: <u>{grading.result.canonicalAnswer}</u>
                        </div>
                        {grading.result.feedbackHint && (
                          <div className="text-xs mt-0.5 opacity-90">
                            {grading.result.feedbackHint}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleOverrideTypo}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border shrink-0 flex items-center gap-1 cursor-pointer theme-surface"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Typo (Mark Right)</span>
                    </button>
                  </div>

                  {grading.relapsedNow && (
                    <div
                      className="p-3 rounded-xl border text-xs flex items-center justify-between gap-2"
                      style={{
                        backgroundColor: 'var(--warn-bg)',
                        borderColor: 'var(--warn-border)',
                        color: 'var(--warn-text)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>
                          <strong>Re-queued with High Priority!</strong> Kept in your Completed list and moved to #1 in the 3×2 Matrix Trainer.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSwitchToTableTrainer(prompt.verb.id)}
                        className="px-2.5 py-1 rounded-lg font-bold underline shrink-0 cursor-pointer"
                      >
                        Practice
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 px-5 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer theme-btn-primary"
              >
                <span>Next Card</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
