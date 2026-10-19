import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import { CefrLevel, UserProgressBlob } from '../types';
import { ALL_VERBS, VERB_MAP } from '../lib/priorityQueue';

interface CompletedListViewProps {
  progress: UserProgressBlob;
  onPracticeVerbInTable: (verbId: string) => void;
}

const TIERS: { level: CefrLevel; title: string; subtitle: string }[] = [
  {
    level: 'A1',
    title: 'Tier 1 • A1 Basic (Verbs #1–25)',
    subtitle: 'Core survival verbs & regular -at / -it / -ovat patterns',
  },
  {
    level: 'A2',
    title: 'Tier 2 • A2 Elementary (Verbs #26–50)',
    subtitle: 'Modals, daily routines & first reflexive (se) verbs',
  },
  {
    level: 'B1',
    title: 'Tier 3 • B1 Intermediate (Verbs #51–75)',
    subtitle: 'Dative reflexives (si), aspect pairs & stem alternations',
  },
  {
    level: 'B2',
    title: 'Tier 4 • B2 Advanced (Verbs #76–100)',
    subtitle: 'Complex irregular stems, motion verbs & abstract discourse',
  },
];

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
    <div className="space-y-6 pb-8">
      {/* Summary Header Card */}
      <div className="tr-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center bg-black border border-white/10 shrink-0"
            style={{ color: 'var(--tr-cyan)' }}
          >
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-2xl text-white">
              Mastered Verbs ({completedRecords.length} / {ALL_VERBS.length})
            </h2>
            <p className="text-[14px] text-[#8E8E93]">
              Sourced from the Czech National Corpus (SYN2020) & Charles University ÚJOP CEFR A1–B2 progression.
            </p>
          </div>
        </div>
      </div>

      {/* Mastered Grid (2 columns on desktop for spacious UX) */}
      {completedRecords.length === 0 ? (
        <div className="tr-card p-8 text-center text-[15px] text-[#8E8E93]">
          You haven’t completed a full verb table yet. Complete all 18 cells of a verb in{' '}
          <strong className="text-white">Conjugate</strong> to add it here!
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
                className="tr-card p-5 flex items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-[21px] text-white">
                      {verb.infinitive}
                    </span>
                    {verb.aspectPairInfinitive && (
                      <span className="text-[13px] text-[#8E8E93]">
                        / {verb.aspectPairInfinitive}
                      </span>
                    )}
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-black text-[#8E8E93] border border-white/10">
                      {verb.level || 'A1'} • #{verb.frequencyRank}
                    </span>
                    {rec.inMatrixQueue ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'var(--tr-orange-soft)',
                          color: 'var(--tr-orange)',
                        }}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Needs Table Review
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'var(--tr-green-soft)',
                          color: 'var(--tr-green)',
                        }}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Mastered
                      </span>
                    )}
                  </div>

                  <div
                    className="text-[15px] font-medium"
                    style={{ color: 'var(--tr-cyan)' }}
                  >
                    “{verb.english}”
                  </div>

                  <div className="flex items-center gap-3 text-[12px] text-[#8E8E93] pt-0.5">
                    <span>
                      Tables:{' '}
                      <strong className="text-white">
                        {rec.tableCompletionsCount}×
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Flashcards:{' '}
                      <strong className="text-white">
                        {accuracy !== null ? `${accuracy}% (${attempts})` : 'No attempts yet'}
                      </strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onPracticeVerbInTable(rec.verbId)}
                  className="px-3.5 py-2 rounded-full text-[13px] font-bold bg-black text-white border border-white/10 hover:border-[#00E5E5]/50 flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  <RotateCcw
                    className="w-3.5 h-3.5"
                    style={{ color: 'var(--tr-cyan)' }}
                  />
                  <span>Drill</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Upcoming Corpus Organized by Progressive CEFR Tiers (A1 -> A2 -> B1 -> B2) */}
      {uncompletedVerbs.length > 0 && (
        <div className="space-y-4">
          {TIERS.map((tier) => {
            const tierVerbs = ALL_VERBS.filter((v) => (v.level || 'A1') === tier.level);
            const remainingInTier = tierVerbs.filter(
              (v) => !progress.verbs[v.id]?.completed
            );
            const masteredInTier = tierVerbs.length - remainingInTier.length;

            if (remainingInTier.length === 0) return null;

            return (
              <div key={tier.level} className="tr-card p-5 sm:p-6 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-[14px] font-bold text-white">
                      {tier.title}
                    </h3>
                    <p className="text-[12px] text-[#8E8E93]">{tier.subtitle}</p>
                  </div>
                  <span
                    className="text-[12px] font-bold px-3 py-1 rounded-full bg-black border border-white/10"
                    style={{ color: 'var(--tr-cyan)' }}
                  >
                    {masteredInTier}/{tierVerbs.length} mastered
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {remainingInTier.map((verb) => (
                    <button
                      key={verb.id}
                      type="button"
                      onClick={() => onPracticeVerbInTable(verb.id)}
                      className="px-3.5 py-2 rounded-2xl text-[13px] font-medium bg-black border border-white/10 hover:border-[#00E5E5]/50 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <span className="text-[#8E8E93] text-[11px]">
                        #{verb.frequencyRank}
                      </span>
                      <span className="font-bold text-white">{verb.infinitive}</span>
                      <span style={{ color: 'var(--tr-cyan)' }}>
                        ({verb.english})
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#545458]" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
