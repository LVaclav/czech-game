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

const TENSE_LABELS: Record<TenseKey, { cz: string; en: string; color: string }> = {
  past: {
    cz: 'Minulý čas',
    en: 'Past Tense',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  present: {
    cz: 'Přítomný čas',
    en: 'Present Tense',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  future: {
    cz: 'Budoucí čas',
    en: 'Future Tense',
    color: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
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
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center max-w-lg mx-auto my-6">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 mx-auto mb-4">
          <BookOpen className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          No Completed Words Yet
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Flashcards pull exclusively from words you have mastered in the{' '}
          <strong className="text-slate-200">3×2 Table Trainer</strong>. Complete your first verb across Past, Present, and Future to unlock Flashcards!
        </p>
        <button
          type="button"
          onClick={() => onSwitchToTableTrainer()}
          className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm inline-flex items-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>Go to 3×2 Table Trainer</span>
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

  /**
   * Allows overriding a typo as right so it doesn't unfairly trigger a relapse.
   */
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
      {/* Pool Status Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>
          Drilling from <strong className="text-slate-200">{completedCount}</strong> completed{' '}
          {completedCount === 1 ? 'verb' : 'verbs'}
        </span>
        <div className="flex items-center gap-2">
          <span>
            Word accuracy: <strong className="text-slate-200">{accuracy}%</strong> ({attempts} tries)
          </span>
          {verbRecord?.inMatrixQueue && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold text-[11px]">
              Re-Queued in Table
            </span>
          )}
        </div>
      </div>

      {/* Main Flashcard */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xl space-y-6">
        {/* Prompt Badges: Tense & Aspect */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border ${tenseInfo.color}`}
          >
            {tenseInfo.cz} ({tenseInfo.en})
          </span>

          {prompt.tense === 'future' && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">
              {prompt.futureMode === 'pf' && prompt.verb.forms.futurePf
                ? `Perfective (${prompt.verb.aspectPairInfinitive})`
                : `Imperfective (budu + ${prompt.verb.infinitive})`}
            </span>
          )}
        </div>

        {/* Target Verb & Person Prompt */}
        <div className="text-center py-2 space-y-3">
          <div>
            <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {prompt.tense === 'future' &&
              prompt.futureMode === 'pf' &&
              prompt.verb.aspectPairInfinitive
                ? prompt.verb.aspectPairInfinitive
                : prompt.verb.infinitive}
            </div>
            <div className="text-sm sm:text-base text-slate-400 font-medium mt-1">
              “{prompt.verb.english}”
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">
              Who:
            </span>
            <span className="text-xl font-extrabold text-indigo-300">
              {personInfo.pronoun}
            </span>
            {personInfo.badge && (
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">
                {personInfo.badge}
              </span>
            )}
            <span className="text-xs text-slate-500">({personInfo.subtitle})</span>
          </div>
        </div>

        {/* Typed Answer Input Form */}
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
              placeholder={`Type the ${tenseInfo.en.toLowerCase()} form for ${personInfo.pronoun}...`}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              className={`w-full px-4 py-3.5 rounded-xl bg-slate-950 border text-center text-base sm:text-lg font-bold outline-none transition-all ${
                !grading
                  ? 'border-slate-700 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                  : grading.result.isValid || grading.overriddenAsCorrect
                  ? 'border-emerald-500/60 bg-emerald-950/20 text-emerald-300'
                  : 'border-rose-500/60 bg-rose-950/20 text-rose-300'
              }`}
            />
          </div>

          {!grading ? (
            <button
              type="submit"
              className="w-full py-3.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
            >
              Check Answer
            </button>
          ) : (
            <div className="space-y-3">
              {/* Grading Result Banner */}
              {grading.result.isValid || grading.overriddenAsCorrect ? (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-emerald-200">
                        Správně! Correct!
                      </div>
                      <div className="text-xs text-emerald-300/80">
                        Canonical form: <strong>{grading.result.canonicalAnswer}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-bold text-rose-200">
                          Expected:{' '}
                          <span className="text-white underline decoration-rose-400">
                            {grading.result.canonicalAnswer}
                          </span>
                        </div>
                        {grading.result.feedbackHint && (
                          <div className="text-xs text-amber-300 mt-0.5">
                            {grading.result.feedbackHint}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleOverrideTypo}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Mark as Right (typo)</span>
                    </button>
                  </div>

                  {/* Relapse Trigger Alert */}
                  {grading.relapsedNow && (
                    <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          <strong>Re-queued for 3×2 Table Practice!</strong> “
                          {prompt.verb.infinitive}” stays in your Completed list, and has been given high priority in the Table Trainer.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSwitchToTableTrainer(prompt.verb.id)}
                        className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold shrink-0 cursor-pointer"
                      >
                        Practice Table
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 px-5 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <span>Next Flashcard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
