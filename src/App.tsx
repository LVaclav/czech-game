import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Grid,
  Languages,
  Layers,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import { AuthUserSession, UserProgressBlob } from './types';
import {
  clearSession,
  fetchUserProgress,
  getSavedSession,
  loadLocalProgress,
  syncUserProgress,
} from './lib/api';
import {
  applyTheme,
  getSavedTheme,
  ThemeId,
} from './lib/theme';
import { VERB_MAP } from './lib/priorityQueue';
import { AuthView } from './components/AuthView';
import { TableTrainerView } from './components/TableTrainerView';
import { FlashcardView } from './components/FlashcardView';
import { CompletedListView } from './components/CompletedListView';
import { AccentBar } from './components/AccentBar';
import { IosInstallBanner } from './components/IosInstallBanner';

type ActiveTab = 'table' | 'flashcards' | 'completed';

export const App: React.FC = () => {
  const [theme, setTheme] = useState<ThemeId>(() => getSavedTheme());

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

  const activeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

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
    completed: 'Saved Verbs',
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Native iOS Modal Sheet for Add to Home Screen (when opened in browser) */}
      <IosInstallBanner />

      {/* Native iOS Navigation Bar */}
      <header className="sticky top-0 z-30 pt-safe ios-chrome ios-hairline-b">
        <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">
          {/* Left: Title */}
          <div className="flex items-center gap-2">
            <Languages
              className="w-5 h-5"
              style={{ color: 'var(--ios-blue)' }}
            />
            <h1 className="font-display text-[19px] tracking-tight">
              {TAB_TITLES[activeTab]}
            </h1>
          </div>

          {/* Right: Streak, Appearance Toggle, User Sign Out */}
          <div className="flex items-center gap-3">
            <span
              className="text-[13px] font-medium tabular-nums"
              style={{ color: 'var(--ios-label-secondary)' }}
              title={`${progress.stats.currentStreak} day streak`}
            >
              {progress.stats.currentStreak}d streak
            </span>

            <button
              type="button"
              onClick={() =>
                setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
              }
              className="p-1.5 rounded-full cursor-pointer transition-opacity active:opacity-60"
              style={{
                backgroundColor: 'var(--ios-fill)',
                color: 'var(--ios-blue)',
              }}
              aria-label="Toggle Light/Dark Mode"
              title="Toggle iOS Light / Dark Appearance"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title={`Signed in as ${session.displayName} (${
                cloudSynced ? 'Synced' : 'Local'
              }) — Tap to Sign Out`}
              className="flex items-center gap-1 text-[13px] font-medium cursor-pointer transition-opacity active:opacity-60"
              style={{ color: 'var(--ios-blue)' }}
            >
              <span className="max-w-[70px] truncate">{session.displayName}</span>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 w-full mx-auto px-4 pt-4 pb-36">
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

      {/* Bottom Sticky Dock: Native iOS Keyboard Accessory Row + Native iOS Tab Bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 flex flex-col">
        {(activeTab === 'table' || activeTab === 'flashcards') && (
          <AccentBar activeInputRef={activeInputRef} />
        )}

        {/* Native iOS UITabBar */}
        <nav className="ios-chrome ios-hairline-t pb-safe">
          <div className="max-w-md mx-auto grid grid-cols-3 h-[50px]">
            {[
              {
                id: 'table' as const,
                label: 'Conjugate',
                icon: Grid,
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
                  className="relative flex flex-col items-center justify-center gap-0.5 cursor-pointer"
                  style={{
                    color: isActive
                      ? 'var(--ios-blue)'
                      : 'var(--ios-label-secondary)',
                  }}
                >
                  <div className="relative">
                    <Icon className="w-[22px] h-[22px]" />
                    {tab.badge && (
                      <span
                        className="-top-1 -right-3.5 absolute px-1.5 min-w-[16px] h-[16px] rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                        style={{
                          backgroundColor:
                            tab.id === 'table'
                              ? 'var(--ios-red)'
                              : 'var(--ios-blue)',
                        }}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium leading-none">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default App;
