import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Hand,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { AuthUserSession, LeaderboardEntry, UserProgressBlob } from '../types';
import {
  ALL_VERBS,
  getEffectiveActivityMap,
  getLongestStreak,
  VERB_MAP,
} from '../lib/priorityQueue';
import { fetchLeaderboard } from '../lib/api';
import { sendLeaderboardNudge } from '../lib/notifications';

interface StreakStatsModalProps {
  session: AuthUserSession;
  progress: UserProgressBlob;
  onClose: () => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatDateKey(year: number, monthIndex0: number, day: number): string {
  const m = String(monthIndex0 + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export const StreakStatsModal: React.FC<StreakStatsModalProps> = ({
  session,
  progress,
  onClose,
}) => {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-11
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(
    now.toISOString().slice(0, 10)
  );
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [nudgingUser, setNudgingUser] = useState<string | null>(null);
  const [nudgedUsers, setNudgedUsers] = useState<Record<string, boolean>>({});
  const [nudgeBanner, setNudgeBanner] = useState<string | null>(null);

  const handleNudgePlayer = async (target: LeaderboardEntry) => {
    const key = target.username.toLowerCase();
    if (nudgingUser || nudgedUsers[key]) return;
    setNudgingUser(key);
    try {
      await sendLeaderboardNudge(session, target.username, target.displayName);
      setNudgedUsers((prev) => ({ ...prev, [key]: true }));
      setNudgeBanner(
        `Sent to ${target.displayName}: "${session.displayName} says you keep conjugating!"`
      );
    } finally {
      setNudgingUser(null);
    }
  };

  const touchStartX = useRef<number | null>(null);

  const activityMap = useMemo(() => getEffectiveActivityMap(progress), [progress]);
  const longestStreak = useMemo(() => getLongestStreak(progress), [progress]);
  const currentStreak = progress.stats.currentStreak || 0;
  const masteredCount = useMemo(
    () =>
      Object.values(progress.verbs).filter(
        (v) => v.completed && VERB_MAP[v.verbId]
      ).length,
    [progress.verbs]
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingBoard(true);
    fetchLeaderboard(session, progress).then((rows) => {
      if (!cancelled) {
        setLeaderboard(rows);
        setLoadingBoard(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session, progress]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) > 42) {
      if (deltaX > 0) {
        handlePrevMonth();
      } else {
        handleNextMonth();
      }
    }
  };

  // Build calendar cells (Monday-first)
  const { daysInMonth, leadingEmptyDays, hitDaysInMonth } = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Convert JS Sunday=0..Saturday=6 into Monday=0..Sunday=6
    const startWeekdayMon0 = (firstDayOfMonth.getDay() + 6) % 7;

    let hitCount = 0;
    for (let d = 1; d <= totalDays; d++) {
      const key = formatDateKey(viewYear, viewMonth, d);
      if ((activityMap[key] || 0) > 0) {
        hitCount += 1;
      }
    }

    return {
      daysInMonth: totalDays,
      leadingEmptyDays: startWeekdayMon0,
      hitDaysInMonth: hitCount,
    };
  }, [viewYear, viewMonth, activityMap]);

  const todayKey = now.toISOString().slice(0, 10);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-t-[36px] sm:rounded-[36px] bg-[#0B0B0D] border border-white/12 p-5 sm:p-6 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Sheet Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#18181B]"
              style={{ color: 'var(--tr-cyan)' }}
            >
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl text-white leading-tight">
                Streak & Leaderboard
              </h2>
              <p className="text-xs text-[#8E8E93]">
                Your daily activity history & community rankings
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[#8E8E93] hover:text-white cursor-pointer tr-circle-glass"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Key Streak & Mastery Metrics */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="tr-card p-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-xs font-semibold text-[#8E8E93]">
              <Flame
                className="w-3.5 h-3.5"
                style={{ color: 'var(--tr-cyan)' }}
              />
              <span>Current</span>
            </div>
            <div
              className="font-display text-2xl sm:text-3xl"
              style={{ color: 'var(--tr-cyan)' }}
            >
              {currentStreak}d
            </div>
            <div className="text-[11px] text-[#8E8E93]">Active streak</div>
          </div>

          <div className="tr-card p-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-xs font-semibold text-[#8E8E93]">
              <Award
                className="w-3.5 h-3.5"
                style={{ color: 'var(--tr-orange)' }}
              />
              <span>Longest</span>
            </div>
            <div className="font-display text-2xl sm:text-3xl text-white">
              {longestStreak}d
            </div>
            <div className="text-[11px] text-[#8E8E93]">All-time best</div>
          </div>

          <div className="tr-card p-4 text-center space-y-1">
            <div className="flex items-center justify-center gap-1 text-xs font-semibold text-[#8E8E93]">
              <Trophy
                className="w-3.5 h-3.5"
                style={{ color: 'var(--tr-green)' }}
              />
              <span>Mastered</span>
            </div>
            <div className="font-display text-2xl sm:text-3xl text-white">
              {masteredCount}
              <span className="text-sm text-[#8E8E93] font-normal">
                /{ALL_VERBS.length}
              </span>
            </div>
            <div className="text-[11px] text-[#8E8E93]">
              {progress.stats.totalTablesCompleted || 0} tables done
            </div>
          </div>
        </div>

        {/* 2. Swipeable Month View Calendar */}
        <div
          className="tr-card p-5 space-y-4 select-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar
                className="w-4 h-4"
                style={{ color: 'var(--tr-cyan)' }}
              />
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </h3>
                <p className="text-[11px] text-[#8E8E93]">
                  Swipe left/right to change month •{' '}
                  <strong style={{ color: 'var(--tr-cyan)' }}>
                    {hitDaysInMonth} hit {hitDaysInMonth === 1 ? 'day' : 'days'}
                  </strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white cursor-pointer tr-circle-glass"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white cursor-pointer tr-circle-glass"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">
            {WEEKDAYS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: leadingEmptyDays }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-10 rounded-xl" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateKey = formatDateKey(viewYear, viewMonth, dayNum);
              const count = activityMap[dateKey] || 0;
              const isHit = count > 0;
              const isToday = dateKey === todayKey;
              const isSelected = selectedDateKey === dateKey;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedDateKey(dateKey)}
                  className="h-10 rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer border"
                  style={
                    isHit
                      ? {
                          backgroundColor: 'rgba(0, 229, 229, 0.18)',
                          borderColor: isSelected
                            ? '#ffffff'
                            : 'rgba(0, 229, 229, 0.55)',
                          color: 'var(--tr-cyan)',
                        }
                      : {
                          backgroundColor: '#000000',
                          borderColor: isSelected
                            ? 'rgba(255, 255, 255, 0.45)'
                            : isToday
                            ? 'rgba(0, 229, 229, 0.4)'
                            : 'rgba(255, 255, 255, 0.06)',
                          color: isToday ? '#ffffff' : '#8E8E93',
                        }
                  }
                >
                  <span className="text-xs font-bold leading-none">{dayNum}</span>
                  {isHit && (
                    <span className="text-[9px] font-extrabold leading-none mt-0.5">
                      🔥
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDateKey && (
            <div className="pt-2 tr-hairline-t flex items-center justify-between text-xs text-[#8E8E93]">
              <span>Selected: {selectedDateKey}</span>
              <span
                className="font-bold"
                style={{
                  color:
                    (activityMap[selectedDateKey] || 0) > 0
                      ? 'var(--tr-cyan)'
                      : '#8E8E93',
                }}
              >
                {(activityMap[selectedDateKey] || 0) > 0
                  ? `🔥 Hit day (${activityMap[selectedDateKey]} ${
                      activityMap[selectedDateKey] === 1
                        ? 'session/table'
                        : 'sessions/tables'
                    })`
                  : 'No recorded sessions'}
              </span>
            </div>
          )}
        </div>

        {/* 3. Community Leaderboard */}
        <div className="tr-card p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users
                className="w-4 h-4"
                style={{ color: 'var(--tr-cyan)' }}
              />
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  Leaderboard
                </h3>
                <p className="text-[11px] text-[#8E8E93]">
                  Ranked by mastered verbs & active streak
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-[#8E8E93]">
              {leaderboard.length} {leaderboard.length === 1 ? 'learner' : 'learners'}
            </span>
          </div>

          {nudgeBanner && (
            <div
              className="px-3.5 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 border"
              style={{
                backgroundColor: 'rgba(0, 229, 229, 0.1)',
                borderColor: 'rgba(0, 229, 229, 0.35)',
                color: 'var(--tr-cyan)',
              }}
            >
              <span>👋 {nudgeBanner}</span>
              <button
                type="button"
                onClick={() => setNudgeBanner(null)}
                className="text-[#8E8E93] hover:text-white cursor-pointer"
                aria-label="Dismiss nudge message"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {loadingBoard ? (
            <div className="py-6 text-center text-xs text-[#8E8E93]">
              Loading leaderboard…
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((row, idx) => {
                const userKey = row.username.toLowerCase();
                const isMe = userKey === session.username.toLowerCase();
                const isNudged = Boolean(nudgedUsers[userKey]);
                const isNudging = nudgingUser === userKey;
                const rank = idx + 1;

                return (
                  <div
                    key={row.username}
                    className="p-3.5 rounded-2xl flex items-center justify-between gap-3 border"
                    style={
                      isMe
                        ? {
                            backgroundColor: 'rgba(0, 229, 229, 0.1)',
                            borderColor: 'rgba(0, 229, 229, 0.45)',
                          }
                        : {
                            backgroundColor: '#000000',
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                          }
                    }
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                        style={
                          rank === 1
                            ? {
                                backgroundColor: 'var(--tr-cyan)',
                                color: '#000000',
                              }
                            : {
                                backgroundColor: '#18181B',
                                color: '#8E8E93',
                              }
                        }
                      >
                        #{rank}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-white truncate">
                            {row.displayName}
                          </span>
                          {isMe && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: 'var(--tr-cyan-soft)',
                                color: 'var(--tr-cyan)',
                              }}
                            >
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#8E8E93]">
                          Best streak: {row.longestStreak}d •{' '}
                          {row.totalTablesCompleted} tables
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {!isMe && (
                        <button
                          type="button"
                          disabled={isNudged || isNudging}
                          onClick={() => handleNudgePlayer(row)}
                          title={`Nudge ${row.displayName} to keep conjugating`}
                          className="h-8 px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 disabled:cursor-default border"
                          style={
                            isNudged
                              ? {
                                  backgroundColor: 'rgba(48, 209, 88, 0.14)',
                                  borderColor: 'rgba(48, 209, 88, 0.45)',
                                  color: 'var(--tr-green)',
                                }
                              : {
                                  backgroundColor: '#18181B',
                                  borderColor: 'rgba(255, 255, 255, 0.14)',
                                  color: '#ffffff',
                                }
                          }
                        >
                          {isNudged ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Nudged</span>
                            </>
                          ) : (
                            <>
                              <Hand
                                className="w-3 h-3"
                                style={{ color: 'var(--tr-cyan)' }}
                              />
                              <span>{isNudging ? '…' : 'Nudge'}</span>
                            </>
                          )}
                        </button>
                      )}

                      <div className="text-right">
                        <div
                          className="text-sm font-bold"
                          style={{ color: 'var(--tr-cyan)' }}
                        >
                          {row.masteredCount} mastered
                        </div>
                        <div className="text-xs font-semibold text-white flex items-center justify-end gap-1">
                          <Flame
                            className="w-3.5 h-3.5"
                            style={{ color: 'var(--tr-cyan)' }}
                          />
                          <span>{row.currentStreak}d streak</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
