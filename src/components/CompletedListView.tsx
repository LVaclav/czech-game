import React from 'react';
import { ChevronRight } from 'lucide-react';
import { UserProgressBlob } from '../types';
import { ALL_VERBS, VERB_MAP } from '../lib/priorityQueue';

interface CompletedListViewProps {
  progress: UserProgressBlob;
  onPracticeVerbInTable: (verbId: string) => void;
}

/**
 * Styled as a native iOS UITableViewStyle.insetGrouped list (like Apple Translate Favorites)
 */
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

  const uncompletedVerbs = ALL_VERBS.filter((v) => !progress.verbs[v.id]?.completed);

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-8">
      {/* Section 1: Completed Verbs (iOS Inset Grouped List) */}
      <div className="space-y-1.5">
        <div
          className="flex items-center justify-between px-4 text-[12px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--ios-label-secondary)' }}
        >
          <span>Mastered Verbs ({completedRecords.length})</span>
          <span>Tap to practice</span>
        </div>

        {completedRecords.length === 0 ? (
          <div
            className="ios-card p-6 text-center text-[15px]"
            style={{ color: 'var(--ios-label-secondary)' }}
          >
            Complete all 18 cells of a verb in the 3×2 Matrix to add it here.
          </div>
        ) : (
          <div className="ios-card overflow-hidden">
            {completedRecords.map((rec, idx) => {
              const verb = VERB_MAP[rec.verbId];
              const attempts = rec.flashcards.totalAttempts;
              const accuracy =
                attempts > 0
                  ? Math.round((rec.flashcards.totalCorrect / attempts) * 100)
                  : null;

              return (
                <button
                  key={rec.verbId}
                  type="button"
                  onClick={() => onPracticeVerbInTable(rec.verbId)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors active:opacity-70 cursor-pointer ${
                    idx < completedRecords.length - 1 ? 'ios-hairline-b' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[17px] font-semibold">
                        {verb.infinitive}
                      </span>
                      {verb.aspectPairInfinitive && (
                        <span
                          className="text-[14px]"
                          style={{ color: 'var(--ios-label-secondary)' }}
                        >
                          / {verb.aspectPairInfinitive}
                        </span>
                      )}
                      {rec.inMatrixQueue && (
                        <span
                          className="text-[11px] font-semibold px-2 py-0.2 rounded-full"
                          style={{
                            backgroundColor: 'var(--ios-orange-bg)',
                            color: 'var(--ios-orange-text)',
                          }}
                        >
                          Priority
                        </span>
                      )}
                    </div>
                    <div
                      className="text-[14px]"
                      style={{ color: 'var(--ios-blue)' }}
                    >
                      {verb.english}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-[13px] tabular-nums"
                      style={{ color: 'var(--ios-label-secondary)' }}
                    >
                      {accuracy !== null ? `${accuracy}%` : `${rec.tableCompletionsCount}×`}
                    </span>
                    <ChevronRight
                      className="w-4 h-4"
                      style={{ color: 'var(--ios-label-tertiary)' }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Upcoming Frequency Corpus (iOS Inset Grouped List) */}
      {uncompletedVerbs.length > 0 && (
        <div className="space-y-1.5">
          <div
            className="px-4 text-[12px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--ios-label-secondary)' }}
          >
            Up Next in Corpus ({uncompletedVerbs.length})
          </div>

          <div className="ios-card overflow-hidden">
            {uncompletedVerbs.map((verb, idx) => (
              <button
                key={verb.id}
                type="button"
                onClick={() => onPracticeVerbInTable(verb.id)}
                className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors active:opacity-70 cursor-pointer ${
                  idx < uncompletedVerbs.length - 1 ? 'ios-hairline-b' : ''
                }`}
              >
                <div className="flex items-baseline gap-2.5">
                  <span
                    className="text-[12px] tabular-nums w-6"
                    style={{ color: 'var(--ios-label-tertiary)' }}
                  >
                    #{verb.frequencyRank}
                  </span>
                  <span className="text-[16px] font-semibold">
                    {verb.infinitive}
                  </span>
                  <span
                    className="text-[14px]"
                    style={{ color: 'var(--ios-label-secondary)' }}
                  >
                    {verb.english}
                  </span>
                </div>

                <ChevronRight
                  className="w-4 h-4 shrink-0"
                  style={{ color: 'var(--ios-label-tertiary)' }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
