import React from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { UserProgressBlob } from '../types';
import { ALL_VERBS, VERB_MAP } from '../lib/priorityQueue';

interface CompletedListViewProps {
  progress: UserProgressBlob;
  onPracticeVerbInTable: (verbId: string) => void;
}

export const CompletedListView: React.FC<CompletedListViewProps> = ({
  progress,
  onPracticeVerbInTable,
}) => {
  const completedRecords = Object.values(progress.verbs)
    .filter((rec) => rec.completed && VERB_MAP[rec.verbId])
    .sort((a, b) => {
      // Show re-queued high-priority words at the top, then by frequency rank
      if (a.inMatrixQueue !== b.inMatrixQueue) {
        return a.inMatrixQueue ? -1 : 1;
      }
      return VERB_MAP[a.verbId].frequencyRank - VERB_MAP[b.verbId].frequencyRank;
    });

  const relapsedCount = completedRecords.filter((r) => r.inMatrixQueue).length;

  return (
    <div className="space-y-4 pb-6">
      {/* Summary Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            <span>Completed Words Pool</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Words stay here permanently once mastered across all 3 tenses. Struggling words in Flashcards are flagged with High Priority for your next 3×2 Table session.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <div className="text-lg font-black text-emerald-400">
              {completedRecords.length} / {ALL_VERBS.length}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
              Mastered
            </div>
          </div>

          {relapsedCount > 0 && (
            <div className="px-3.5 py-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-center">
              <div className="text-lg font-black text-amber-300">{relapsedCount}</div>
              <div className="text-[10px] uppercase tracking-wider text-amber-400/80 font-bold">
                Re-Queued
              </div>
            </div>
          )}
        </div>
      </div>

      {completedRecords.length === 0 ? (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 text-center">
          <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            Complete all 18 cells (Past, Present & Future) of a verb in the{' '}
            <strong className="text-slate-200">3×2 Table Trainer</strong> to add it to your Completed list.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {completedRecords.map((rec) => {
            const verb = VERB_MAP[rec.verbId];
            const attempts = rec.flashcards.totalAttempts;
            const accuracy =
              attempts > 0
                ? Math.round((rec.flashcards.totalCorrect / attempts) * 100)
                : null;

            return (
              <div
                key={rec.verbId}
                className={`rounded-2xl p-4 border transition-all flex items-center justify-between gap-3 ${
                  rec.inMatrixQueue
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-white">
                      {verb.infinitive}
                    </span>
                    {verb.aspectPairInfinitive && (
                      <span className="text-xs text-indigo-300 font-medium">
                        / {verb.aspectPairInfinitive}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">— {verb.english}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      3×2 Passed {rec.tableCompletionsCount}×
                    </span>

                    <span>•</span>

                    <span>
                      Flashcards:{' '}
                      {accuracy !== null ? (
                        <strong
                          className={
                            accuracy >= 80
                              ? 'text-emerald-300'
                              : accuracy >= 50
                              ? 'text-amber-300'
                              : 'text-rose-300'
                          }
                        >
                          {accuracy}% ({rec.flashcards.totalCorrect}/{attempts})
                        </strong>
                      ) : (
                        <span className="text-slate-500">Not drilled yet</span>
                      )}
                    </span>

                    {rec.inMatrixQueue && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                        <AlertTriangle className="w-3 h-3" />
                        Priority {rec.priorityScore}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onPracticeVerbInTable(rec.verbId)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 hover:border-indigo-500 transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>3×2 Table</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Unseen Corpus Preview */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Upcoming Verbs in Frequency Queue</span>
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {ALL_VERBS.filter((v) => !progress.verbs[v.id]?.completed).map((verb) => (
            <button
              key={verb.id}
              type="button"
              onClick={() => onPracticeVerbInTable(verb.id)}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 transition-all cursor-pointer"
            >
              <span className="text-slate-500 mr-1">#{verb.frequencyRank}</span>
              <strong className="text-slate-200">{verb.infinitive}</strong>{' '}
              <span className="text-slate-500">({verb.english})</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
