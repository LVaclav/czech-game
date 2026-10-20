import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Flame,
  Languages,
  Layers,
  List,
  LogOut,
  MoreHorizontal,
} from 'lucide-react';
import { AuthUserSession, UserProgressBlob } from './types';
import {
  clearSession,
  fetchUserProgress,
  getSavedSession,
  loadLocalProgress,
  syncUserProgress,
} from './lib/api';
import { AuthView } from './components/AuthView';
import { TableTrainerView } from './components/TableTrainerView';
import { FlashcardView } from './components/FlashcardView';
import { CompletedListView } from './components/CompletedListView';
import { IosInstallBanner } from './components/IosInstallBanner';
import { StreakStatsModal } from './components/StreakStatsModal';
import { ALL_VERBS, VERB_MAP } from './lib/priorityQueue';

type ActiveTab = 'table' | 'flashcards' | 'completed';
const EVENING_REMINDER_HOUR = 19;
const EVENING_REMINDER_LAST_CHECK_KEY = 'czech_trainer_evening_reminder_last_check_v1';

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const App: React.FC = () => {
  const [session, setSession] = useState<AuthUserSession | null>(() =>
    getSavedSession()
  );
  const [progress, setProgress] = useState<UserProgressBlob | null>(() => {
    const s = getSavedSession();
    return s ? loadLocalProgress(s.username) : null;
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('table');
  const [forcedVerbId, setForcedVerbId] = useState<string | null>(null);
  const [cloudSynced, setCloudSynced] = useState<boolean>(false);
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
  const [showStreakModal, setShowStreakModal] = useState<boolean>(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);
  const [isScrolled, setIsScrolled] = useState<boolean>(false);

  const activeInputRef = useRef<HTMLInputElement | null>(null);

  // Track window scroll to morph the sticky top bar into the iOS 26 Translate compact header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Hide the bottom menu bar when an input is focused so the iOS keyboard covers it cleanly
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      if (
        e.target instanceof HTMLInputElement &&
        !e.target.readOnly &&
        !e.target.disabled
      ) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        const active = document.activeElement;
        const stillFocused =
          active instanceof HTMLInputElement &&
          !active.readOnly &&
          !active.disabled;
        setIsKeyboardOpen(stillFocused);
      }, 60);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const initialLocal = loadLocalProgress(session.username);
    setProgress(initialLocal);

    fetchUserProgress(session).then(({ progress: merged, syncedWithCloud }) => {
      if (!cancelled) {
        setProgress(merged);
        setCloudSynced(syncedWithCloud);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session || !progress || typeof window === 'undefined') {
      return;
    }

    let timeoutId: number | null = null;

    const maybeSendEveningReminder = async () => {
      const now = new Date();
      if (now.getHours() < EVENING_REMINDER_HOUR) {
        return;
      }

      const todayKey = getLocalDateKey(now);
      const utcTodayKey = now.toISOString().slice(0, 10);
      const lastCheckDate = localStorage.getItem(EVENING_REMINDER_LAST_CHECK_KEY);
      if (lastCheckDate === todayKey) {
        return;
      }
      localStorage.setItem(EVENING_REMINDER_LAST_CHECK_KEY, todayKey);

      const alreadyPracticedToday =
        (progress.stats.lastActiveDate === todayKey ||
          progress.stats.lastActiveDate === utcTodayKey) &&
        progress.stats.tablesCompletedToday > 0;
      if (alreadyPracticedToday || !('Notification' in window)) {
        return;
      }

      const sendNotification = async () => {
        const title = "Don't lose your streak 🔥";
        const body = `${session.displayName}, do one quick table tonight to keep your Czech streak alive.`;

        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            await registration.showNotification(title, {
              body,
              tag: `streak-reminder-${todayKey}`,
            });
            return;
          }
        }

        new Notification(title, {
          body,
          tag: `streak-reminder-${todayKey}`,
        });
      };

      if (Notification.permission === 'granted') {
        await sendNotification();
      } else if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          await sendNotification();
        }
      }
    };

    const scheduleNextEveningCheck = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(EVENING_REMINDER_HOUR, 0, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      const delayMs = Math.max(next.getTime() - now.getTime(), 1000);
      timeoutId = window.setTimeout(() => {
        maybeSendEveningReminder().catch(() => {
          // Ignore notification errors in restricted environments
        });
        scheduleNextEveningCheck();
      }, delayMs);
    };

    maybeSendEveningReminder().catch(() => {
      // Ignore notification errors in restricted environments
    });
    scheduleNextEveningCheck();

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    session,
    progress,
    progress?.stats.lastActiveDate,
    progress?.stats.tablesCompletedToday,
  ]);

  const handleUpdateProgress = useCallback(
    (next: UserProgressBlob) => {
      setProgress(next);
      if (session) {
        syncUserProgress(session, next).then((ok) => {
          setCloudSynced(ok);
        });
      }
    },
    [session]
  );

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setProgress(null);
    setCloudSynced(false);
    setShowMoreMenu(false);
  };

  const handleJumpToVerbInTable = useCallback((verbId?: string) => {
    if (verbId) {
      setForcedVerbId(verbId);
    }
    setActiveTab('table');
  }, []);

  if (!session || !progress) {
    return (
      <>
        {/* 8px solid black fixed top strip forces iOS WebKit to sample #000000 for the status bar instead of applying system frosted-glass blur */}
        <div
          aria-hidden="true"
          className="fixed top-0 inset-x-0 h-[8px] bg-black z-60 pointer-events-none"
        />
        <IosInstallBanner />
        <AuthView
          onAuthenticated={(newSession) => {
            setSession(newSession);
            setProgress(loadLocalProgress(newSession.username));
          }}
        />
      </>
    );
  }

  const completedCount = Object.values(progress.verbs).filter(
    (v) => v.completed && VERB_MAP[v.verbId]
  ).length;
  const relapsedCount = Object.values(progress.verbs).filter(
    (v) => v.completed && v.inMatrixQueue && VERB_MAP[v.verbId]
  ).length;

  const TAB_TITLES: Record<ActiveTab, string> = {
    table: 'Conjugate',
    flashcards: 'Flashcards',
    completed: 'Vocabulary',
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-black text-white">
      {/* 8px solid black fixed element at top:0 forces iOS status bar to adopt solid #000000 instead of system frosted blur */}
      <div
        aria-hidden="true"
        className="fixed top-0 inset-x-0 h-[8px] bg-black z-60 pointer-events-none"
      />

      <IosInstallBanner />
      {showStreakModal && (
        <StreakStatsModal
          session={session}
          progress={progress}
          onClose={() => setShowStreakModal(false)}
        />
      )}

      {/* Sticky Top Toolbar: Circular Liquid Glass Buttons + Centered Inline Title on Scroll (1:1 with iOS 26 Translate) */}
      <div
        className={`sticky top-0 z-40 pt-safe transition-all duration-200 ${
          isScrolled ? 'tr-sticky-header-scrolled' : 'bg-transparent'
        }`}
      >
        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 pt-2.5 pb-2.5 flex items-center justify-between gap-2">
          {/* Left Circular Liquid Glass Button (Quick Vocabulary Toggle) */}
          <button
            type="button"
            onClick={() =>
              setActiveTab((prev) =>
                prev === 'completed' ? 'table' : 'completed'
              )
            }
            className="w-[46px] h-[46px] shrink-0 rounded-full flex items-center justify-center cursor-pointer tr-circle-glass"
            aria-label="Vocabulary List"
            title="Saved Vocabulary"
          >
            <List
              className="w-[22px] h-[22px]"
              style={{
                color: activeTab === 'completed' ? 'var(--tr-cyan)' : '#ffffff',
              }}
            />
          </button>

          {/* Centered Between Left Button and Leaderboard/Streak Button */}
          <div
            className={`flex-1 text-center text-[17px] font-semibold text-white tracking-tight truncate pointer-events-none transition-all duration-200 ${
              isScrolled
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-1.5'
            }`}
          >
            {TAB_TITLES[activeTab]}
          </div>

          {/* Right Circular Controls: Tappable Streak Badge + ••• User Menu */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowStreakModal(true)}
              title="Tap to view streak history, calendar & leaderboard"
              className="h-[46px] px-3.5 rounded-full flex items-center gap-1.5 text-[14px] font-bold cursor-pointer active:scale-95 transition-transform tr-circle-glass"
            >
              <Flame
                className="w-4 h-4"
                style={{ color: 'var(--tr-cyan)' }}
              />
              <span>{progress.stats.currentStreak}d</span>
              <span className="text-[#8E8E93] hidden sm:inline">
                • {progress.stats.tablesCompletedToday} today
              </span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreMenu((prev) => !prev)}
                className="w-[46px] h-[46px] rounded-full flex items-center justify-center cursor-pointer tr-circle-glass"
                aria-label="Account Menu"
              >
                <MoreHorizontal className="w-[22px] h-[22px] text-white" />
              </button>

              {showMoreMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMoreMenu(false)}
                  />
                  <div className="absolute right-0 mt-2.5 w-64 rounded-[26px] p-2.5 z-50 space-y-1 tr-bottom-dock-glass">
                    <div className="px-3.5 py-2.5 flex items-center justify-between tr-hairline-b">
                      <div>
                        <div className="text-[15px] font-bold text-white">
                          {session.displayName}
                        </div>
                        <div className="text-[12px] text-[#8E8E93]">
                          {cloudSynced
                            ? 'Synced to Netlify Blobs'
                            : 'Saved on device'}
                        </div>
                      </div>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor: cloudSynced
                            ? 'var(--tr-green)'
                            : '#8E8E93',
                        }}
                      />
                    </div>

                    <div className="px-3.5 py-2 text-[13px] text-[#8E8E93] flex justify-between">
                      <span>Mastered Verbs</span>
                      <strong className="text-white">
                        {completedCount} / {ALL_VERBS.length}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-3.5 py-2.5 rounded-[18px] text-[14px] font-semibold text-[#FF453A] hover:bg-white/5 flex items-center justify-between cursor-pointer"
                    >
                      <span>Switch User / Sign Out</span>
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Large Bold iOS Title (Scrolls naturally underneath the sticky top bar and fades out) */}
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 pt-1 pb-2">
        <h1
          className={`font-display text-[34px] sm:text-[38px] leading-[1.08] text-white tracking-tight transition-opacity duration-150 ${
            isScrolled ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {TAB_TITLES[activeTab]}
        </h1>
      </div>

      {/* Full-Bleed Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-1 pb-28">
        {activeTab === 'table' && (
          <TableTrainerView
            progress={progress}
            onUpdateProgress={handleUpdateProgress}
            forcedVerbId={forcedVerbId}
            onClearForcedVerb={() => setForcedVerbId(null)}
            activeInputRef={activeInputRef}
          />
        )}

        {activeTab === 'flashcards' && (
          <FlashcardView
            progress={progress}
            onUpdateProgress={handleUpdateProgress}
            onSwitchToTableTrainer={handleJumpToVerbInTable}
            activeInputRef={activeInputRef}
          />
        )}

        {activeTab === 'completed' && (
          <CompletedListView
            progress={progress}
            onPracticeVerbInTable={(verbId) => handleJumpToVerbInTable(verbId)}
          />
        )}
      </main>

      {/* Bottom Floating Liquid Glass Tab Bar: Rests at the bottom of the screen, and hides behind the keyboard when typing */}
      <div
        className={`fixed inset-x-0 z-30 flex justify-center px-4 tr-bottom-dock-position transition-opacity duration-150 ${
          isKeyboardOpen
            ? 'opacity-0 pointer-events-none'
            : 'opacity-100 pointer-events-auto'
        }`}
      >
        <nav className="w-[336px] h-[62px] p-[4px] rounded-full grid grid-cols-3 items-center tr-bottom-dock-glass">
          {[
            {
              id: 'table' as const,
              label: 'Conjugate',
              icon: Languages,
              badge: relapsedCount > 0 ? String(relapsedCount) : null,
            },
            {
              id: 'flashcards' as const,
              label: 'Flashcards',
              icon: Layers,
              badge: null,
            },
            {
              id: 'completed' as const,
              label: 'Saved',
              icon: Bookmark,
              badge: completedCount > 0 ? String(completedCount) : null,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative h-full rounded-full flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                  isActive ? 'tr-bottom-tab-active' : ''
                }`}
                style={{
                  color: isActive ? 'var(--tr-cyan)' : '#ffffff',
                }}
              >
                <div className="relative">
                  <Icon className="w-[22px] h-[22px]" strokeWidth={2.1} />
                  {tab.badge && (
                    <span
                      className="-top-1 -right-3.5 absolute px-1.5 min-w-[15px] h-[15px] rounded-full text-[9px] font-black flex items-center justify-center"
                      style={{
                        backgroundColor: isActive ? 'var(--tr-cyan)' : '#ffffff',
                        color: '#000000',
                      }}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold tracking-tight leading-none">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default App;
