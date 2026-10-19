import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  RotateCcw,
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
      <div className="max-w-lg mx-auto my-6 p-8 text-center ios-card space-y-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
          style={{
            backgroundColor: 'var(--ios-fill)',
            color: 'var(--ios-blue)',
          }}
        >
          <BookOpen className="w-6 h-6" />
        </div>
        <h2 className="font-display text-[22px]">No Completed Verbs Yet</h2>
        <p
          className="text-[15px] leading-relaxed"
          style={{ color: 'var(--ios-label-secondary)' }}
        >
          Complete your first verb across Past, Present, and Future in the{' '}
          <strong>3×2 Matrix</strong> to unlock Flashcard drills.
        </p>
        <button
          type="button"
          onClick={() => onSwitchToTableTrainer()}
          className="px-6 py-3 text-[15px] inline-flex items-center gap-2 cursor-pointer ios-btn-blue"
        >
          <span>Open 3×2 Matrix</span>
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
    <div className="max-w-lg mx-auto space-y-4 pb-6">
      {/* iOS Section Header */}
      <div
        className="flex items-center justify-between text-[12px] font-semibold uppercase tracking-wide px-4"
        style={{ color: 'var(--ios-label-secondary)' }}
      >
        <span>{tenseInfo.cz} ({tenseInfo.en})</span>
        <span>Accuracy: {accuracy}%</span>
      </div>

      {/* Apple Translate Dual-Pane Flashcard */}
      <div className="ios-card overflow-hidden">
        {/* Top Pane: Verb & Person Prompt */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-[12px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--ios-label-secondary)' }}
            >
              Infinitive • {prompt.verb.english}
            </span>

            {prompt.tense === 'future' && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'var(--ios-fill)',
                  color: 'var(--ios-label)',
                }}
              >
                {prompt.futureMode === 'pf' && prompt.verb.forms.futurePf
                  ? `Perfective (${prompt.verb.aspectPairInfinitive})`
                  : `Imperfective (budu + ${prompt.verb.infinitive})`}
              </span>
            )}
          </div>

          <div className="font-display text-[32px] leading-tight">
            {prompt.tense === 'future' &&
            prompt.futureMode === 'pf' &&
            prompt.verb.aspectPairInfinitive
              ? prompt.verb.aspectPairInfinitive
              : prompt.verb.infinitive}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span
              className="text-[13px] font-medium"
              style={{ color: 'var(--ios-label-secondary)' }}
            >
              Person:
            </span>
            <span
              className="text-[16px] font-bold"
              style={{ color: 'var(--ios-blue)' }}
            >
              {personInfo.pronoun}
            </span>
            {personInfo.badge && (
              <span
                className="px-2 py-0.5 rounded-md text-[12px] font-semibold"
                style={{
                  backgroundColor: 'var(--ios-fill)',
                  color: 'var(--ios-label)',
                }}
              >
                {personInfo.badge}
              </span>
            )}
            <span
              className="text-[13px]"
              style={{ color: 'var(--ios-label-secondary)' }}
            >
              ({personInfo.subtitle})
            </span>
          </div>
        </div>

        {/* Hairline 0.5px Separator */}
        <div className="mx-5 ios-hairline-t" />

        {/* Bottom Pane: User Typed Czech Answer */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <div
              className="text-[12px] font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--ios-blue)' }}
            >
              Your Conjugation ({personInfo.pronoun})
            </div>
            <input
              ref={inputRef}
              type="text"
              value={answer}
              readOnly={Boolean(grading)}
              onFocus={(e) => {
                activeInputRef.current = e.currentTarget;
              }}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Enter Czech form..."
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              className="w-full bg-transparent font-display text-[26px] outline-none"
              style={{
                color: !grading
                  ? 'var(--ios-blue)'
                  : grading.result.isValid || grading.overriddenAsCorrect
                  ? 'var(--ios-green-text)'
                  : 'var(--ios-red-text)',
              }}
            />
          </div>

          {!grading ? (
            <button
              type="submit"
              className="w-full py-3.5 px-5 text-[16px] cursor-pointer ios-btn-blue"
            >
              Check Answer
            </button>
          ) : (
            <div className="space-y-3 pt-1">
              {grading.result.isValid || grading.overriddenAsCorrect ? (
                <div
                  className="p-3.5 rounded-[14px] flex items-center gap-2.5 text-[14px] font-semibold"
                  style={{
                    backgroundColor: 'var(--ios-green-bg)',
                    color: 'var(--ios-green-text)',
                  }}
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>Correct — {grading.result.canonicalAnswer}</span>
                </div>
              ) : (
                <div
                  className="p-3.5 rounded-[14px] space-y-2.5"
                  style={{
                    backgroundColor: 'var(--ios-red-bg)',
                    color: 'var(--ios-red-text)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[14px] font-semibold">
                          Expected: <u>{grading.result.canonicalAnswer}</u>
                        </div>
                        {grading.result.feedbackHint && (
                          <div className="text-[12px] mt-0.5 opacity-90">
                            {grading.result.feedbackHint}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleOverrideTypo}
                      className="px-2.5 py-1 rounded-lg text-[12px] font-semibold shrink-0 flex items-center gap-1 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--ios-card)',
                        color: 'var(--ios-blue)',
                      }}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Typo</span>
                    </button>
                  </div>

                  {grading.relapsedNow && (
                    <div
                      className="p-2.5 rounded-xl text-[12px] flex items-center justify-between gap-2"
                      style={{
                        backgroundColor: 'var(--ios-orange-bg)',
                        color: 'var(--ios-orange-text)',
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>
                          Re-queued with High Priority in 3×2 Matrix (still in your Completed list).
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSwitchToTableTrainer(prompt.verb.id)}
                        className="font-bold underline shrink-0 cursor-pointer"
                      >
                        Practice
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 px-5 text-[16px] flex items-center justify-center gap-2 cursor-pointer ios-btn-blue"
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
