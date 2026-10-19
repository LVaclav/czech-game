import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Layers,
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
      if (a.inMatrixQueue !== b.inMatrixQueue) {
        return a.inMatrixQueue ? -1 : 1;
      }
      return VERB_MAP[a.verbId].frequencyRank - VERB_MAP[b.verbId].frequencyRank;
    });

  const relapsedCount = completedRecords.filter((r) => r.inMatrixQueue).length;

  return (
    <div className="space-y-5 pb-6">
      {/* Summary Header Card */}
      <div className="rounded-3xl p-5 sm:p-7 border flex flex-wrap items-center justify-between gap-4 theme-surface">
        <div className="space-y-1 max-w-xl">
          <h2
            className="font-display text-3xl sm:text-4xl font-normal tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Completed Vocabulary
          </h2>
          <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
            Verbs stay here permanently once you complete their 3×2 tables across all 3 tenses. Any verb missed repeatedly in Flashcards gets a Priority badge for your next matrix session.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2.5 rounded-2xl border text-center theme-subtle">
            <div
              className="text-xl font-extrabold"
              style={{ color: 'var(--accent-primary)' }}
            >
              {completedRecords.length} / {ALL_VERBS.length}
            </div>
            <div
              className="text-[10px] uppercase tracking-widest font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              Mastered
            </div>
          </div>

          {relapsedCount > 0 && (
            <div
              className="px-4 py-2.5 rounded-2xl border text-center"
              style={{
                backgroundColor: 'var(--warn-bg)',
                borderColor: 'var(--warn-border)',
                color: 'var(--warn-text)',
              }}
            >
              <div className="text-xl font-extrabold">{relapsedCount}</div>
              <div className="text-[10px] uppercase tracking-widest font-bold">
                Re-Queued
              </div>
            </div>
          )}
        </div>
      </div>

      {completedRecords.length === 0 ? (
        <div className="rounded-3xl p-10 text-center border theme-surface">
          <Layers
            className="w-8 h-8 mx-auto mb-2"
            style={{ color: 'var(--text-muted)' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Complete all 18 cells of a verb in the <strong>3×2 Matrix Trainer</strong> to add it to your vocabulary pool.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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
                className="rounded-2xl p-4 border transition-all flex items-center justify-between gap-3 theme-surface"
                style={
                  rec.inMatrixQueue
                    ? { borderColor: 'var(--warn-border)' }
                    : undefined
                }
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span
                      className="font-display text-2xl leading-none"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {verb.infinitive}
                    </span>
                    {verb.aspectPairInfinitive && (
                      <span
                        className="text-xs font-semibold"
                        style={{ color: 'var(--accent-primary)' }}
                      >
                        / {verb.aspectPairInfinitive}
                      </span>
                    )}
                    <span
                      className="text-xs"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      — {verb.english}
                    </span>
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-2 text-[11px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span
                      className="inline-flex items-center gap-1 font-semibold"
                      style={{ color: 'var(--success-text)' }}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Matrix {rec.tableCompletionsCount}×
                    </span>

                    <span>•</span>

                    <span>
                      Flashcards:{' '}
                      {accuracy !== null ? (
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {accuracy}% ({rec.flashcards.totalCorrect}/{attempts})
                        </strong>
                      ) : (
                        <span>Not drilled yet</span>
                      )}
                    </span>

                    {rec.inMatrixQueue && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full font-bold"
                        style={{
                          backgroundColor: 'var(--warn-bg)',
                          color: 'var(--warn-text)',
                          border: '1px solid var(--warn-border)',
                        }}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Priority {rec.priorityScore}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onPracticeVerbInTable(rec.verbId)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer theme-subtle"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <span>Practice</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Corpus Overview */}
      <div className="rounded-3xl p-5 border theme-surface">
        <h3
          className="text-[11px] font-bold uppercase tracking-widest mb-3"
          style={{ color: 'var(--text-muted)' }}
        >
          Upcoming Verbs by Frequency
        </h3>
        <div className="flex flex-wrap gap-2">
          {ALL_VERBS.filter((v) => !progress.verbs[v.id]?.completed).map((verb) => (
            <button
              key={verb.id}
              type="button"
              onClick={() => onPracticeVerbInTable(verb.id)}
              className="px-3 py-1.5 rounded-xl text-xs border transition-all cursor-pointer theme-subtle"
              style={{ color: 'var(--text-primary)' }}
            >
              <span className="opacity-50 mr-1">#{verb.frequencyRank}</span>
              <strong>{verb.infinitive}</strong>{' '}
              <span style={{ color: 'var(--text-secondary)' }}>({verb.english})</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
