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
      <div className="max-w-xl mx-auto tr-card p-8 text-center space-y-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto bg-black border border-white/10"
          style={{ color: 'var(--tr-cyan)' }}
        >
          <BookOpen className="w-6 h-6" />
        </div>
        <h2 className="font-display text-[24px] text-white">
          Unlock Flashcards by Completing a Verb
        </h2>
        <p className="text-[15px] text-[#8E8E93] leading-relaxed">
          Flashcards pull exclusively from your <strong>Completed Verbs</strong> pool.
          Finish all 18 forms of your first verb in <strong>Conjugate</strong> to unlock
          spaced flashcard practice!
        </p>
        <button
          type="button"
          onClick={() => onSwitchToTableTrainer()}
          className="px-6 py-3 text-[15px] inline-flex items-center gap-2 cursor-pointer tr-btn-cyan"
        >
          <Sparkles className="w-4 h-4" />
          <span>Go to Conjugate</span>
        </button>
      </div>
    );
  }

  const personInfo = formatPersonLabel(prompt.person, prompt.tense, prompt.genders);
  const tenseInfo = TENSE_LABELS[prompt.tense];
  const verbRecord = progress.verbs[prompt.verb.id];
  const fcStats = verbRecord?.flashcards;

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

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Pool & Word Accuracy Bar */}
      <div className="flex items-center justify-between text-[13px] font-medium px-2 text-[#8E8E93]">
        <span>
          Drawing from <strong className="text-white">{completedCount}</strong> mastered{' '}
          {completedCount === 1 ? 'verb' : 'verbs'}
        </span>
        {fcStats && fcStats.totalAttempts > 0 && (
          <span>
            Word accuracy:{' '}
            <strong style={{ color: 'var(--tr-cyan)' }}>
              {Math.round((fcStats.totalCorrect / fcStats.totalAttempts) * 100)}%
            </strong>{' '}
            ({fcStats.totalCorrect}/{fcStats.totalAttempts})
          </span>
        )}
      </div>

      {/* Main Flashcard Surface in Translate Dark Matte Card */}
      <div className="tr-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span
            className="text-[12px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-black border border-white/10"
            style={{ color: 'var(--tr-cyan)' }}
          >
            {tenseInfo.cz} • {tenseInfo.en}
          </span>

          {prompt.tense === 'future' && prompt.futureMode === 'pf' && (
            <span
              className="text-[12px] font-semibold px-3 py-1 rounded-full"
              style={{
                backgroundColor: 'var(--tr-orange-soft)',
                color: 'var(--tr-orange)',
              }}
            >
              Perfective Pair ({prompt.verb.aspectPairInfinitive})
            </span>
          )}
        </div>

        <div className="text-center space-y-2 py-2">
          <div className="text-[13px] uppercase tracking-widest font-semibold text-[#8E8E93]">
            Conjugate in Czech
          </div>
          <h2 className="font-display text-3xl sm:text-4xl text-white">
            {prompt.tense === 'future' &&
            prompt.futureMode === 'pf' &&
            prompt.verb.aspectPairInfinitive
              ? prompt.verb.aspectPairInfinitive
              : prompt.verb.infinitive}
          </h2>
          <p
            className="text-[17px] font-medium"
            style={{ color: 'var(--tr-cyan)' }}
          >
            “{prompt.verb.english}”
          </p>

          <div className="pt-3 flex items-center justify-center gap-2">
            <span className="px-4 py-1.5 rounded-full text-[16px] font-bold bg-black text-white border border-white/10">
              {personInfo.pronoun}
            </span>
            {personInfo.badge && (
              <span
                className="px-3 py-1.5 rounded-full text-[13px] font-bold bg-black border border-white/10"
                style={{ color: 'var(--tr-cyan)' }}
              >
                {personInfo.badge}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              ref={inputRef}
              type="text"
              value={answer}
              readOnly={Boolean(grading)}
              onFocus={(e) => {
                activeInputRef.current = e.currentTarget;
              }}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={`Type ${personInfo.pronoun.toLowerCase()} form…`}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              className={`w-full text-center text-[20px] font-semibold px-4 py-3.5 rounded-2xl border outline-none transition-all ${
                !grading
                  ? 'bg-black/65 border-white/10 focus:border-[#00E5E5]'
                  : grading.result.isValid || grading.overriddenAsCorrect
                  ? 'border-[#30D158]/50'
                  : 'border-[#FF453A]/55'
              }`}
              style={{
                color: !grading
                  ? 'var(--tr-cyan)'
                  : grading.result.isValid || grading.overriddenAsCorrect
                  ? 'var(--tr-green)'
                  : 'var(--tr-red)',
                backgroundColor: !grading
                  ? undefined
                  : grading.result.isValid || grading.overriddenAsCorrect
                  ? 'var(--tr-green-soft)'
                  : 'var(--tr-red-soft)',
              }}
            />
          </div>

          {!grading ? (
            <button
              type="submit"
              className="w-full py-3.5 px-5 text-[16px] cursor-pointer tr-btn-cyan"
            >
              Check Answer
            </button>
          ) : (
            <div className="space-y-3">
              {grading.result.isValid || grading.overriddenAsCorrect ? (
                <div
                  className="p-4 rounded-2xl flex items-center justify-between gap-3"
                  style={{
                    backgroundColor: 'var(--tr-green-soft)',
                    color: 'var(--tr-green)',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="text-[15px] font-bold">
                        Správně! ({grading.result.canonicalAnswer})
                      </div>
                      {grading.overriddenAsCorrect && (
                        <div className="text-[12px] opacity-85">
                          Marked as typo override — streak preserved.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="p-4 rounded-2xl space-y-3"
                  style={{
                    backgroundColor: 'var(--tr-red-soft)',
                    color: 'var(--tr-red)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[15px] font-bold">
                          Expected:{' '}
                          <span className="underline">
                            {grading.result.canonicalAnswer}
                          </span>
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
                      className="px-3 py-1.5 rounded-full text-[12px] font-bold bg-black text-white border border-white/10 shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>I made a typo</span>
                    </button>
                  </div>

                  {grading.relapsedNow && (
                    <div
                      className="p-3 rounded-xl flex items-center justify-between gap-3 text-[12px]"
                      style={{
                        backgroundColor: 'var(--tr-orange-soft)',
                        color: 'var(--tr-orange)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>
                          <strong>Relapse detected:</strong> Re-queued at the top of{' '}
                          <strong>Conjugate</strong> while staying in your flashcards.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSwitchToTableTrainer(prompt.verb.id)}
                        className="px-2.5 py-1 rounded-lg bg-black font-bold shrink-0 cursor-pointer"
                        style={{ color: 'var(--tr-cyan)' }}
                      >
                        Practice Table
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 px-5 text-[16px] flex items-center justify-center gap-2 cursor-pointer tr-btn-cyan"
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
