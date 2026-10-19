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
import { AccentBar } from './components/AccentBar';
import { IosInstallBanner } from './components/IosInstallBanner';
import { StreakStatsModal } from './components/StreakStatsModal';
import { ALL_VERBS, VERB_MAP } from './lib/priorityQueue';

type ActiveTab = 'table' | 'flashcards' | 'completed';

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

  const activeInputRef = useRef<HTMLInputElement | null>(null);

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
      <div className="h-full w-full overflow-y-auto bg-black text-white">
        <IosInstallBanner />
        <AuthView
          onAuthenticated={(newSession) => {
            setSession(newSession);
            setProgress(loadLocalProgress(newSession.username));
          }}
        />
      </div>
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
    <div className="h-full w-full overflow-hidden flex flex-col bg-black text-white">
      <IosInstallBanner />
      {showStreakModal && (
        <StreakStatsModal
          session={session}
          progress={progress}
          onClose={() => setShowStreakModal(false)}
        />
      )}

      {/* Solid Black Top Safe-Area Spacer — prevents scrolled content from entering the status bar or triggering iOS WebKit's top scroll blur */}
      <div className="pt-safe shrink-0 bg-black" />

      {/* Internal Scroll Container (keeps window.scrollY === 0 at all times so iOS never adds a top blur) */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain">
        {/* Top Header */}
        <header className="px-4 sm:px-6 pt-3 pb-2 max-w-5xl w-full mx-auto">
          <div className="flex items-center justify-between mb-3">
            {/* Left Circular Liquid Glass Button (Quick Vocabulary Toggle) */}
            <button
              type="button"
              onClick={() =>
                setActiveTab((prev) =>
                  prev === 'completed' ? 'table' : 'completed'
                )
              }
              className="w-[46px] h-[46px] rounded-full flex items-center justify-center cursor-pointer tr-circle-glass"
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

            {/* Right Circular Controls: Tappable Streak Badge + ••• User Menu */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowStreakModal(true)}
                title="Tap to view streak history, calendar & leaderboard"
                className="h-[46px] px-4 rounded-full flex items-center gap-2 text-[14px] font-bold cursor-pointer active:scale-95 transition-transform tr-circle-glass"
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

          {/* Large Bold iOS Title */}
          <h1 className="font-display text-[34px] sm:text-[38px] leading-[1.08] text-white tracking-tight">
            {TAB_TITLES[activeTab]}
          </h1>
        </header>

        {/* Main Content Area */}
        <main
          className={`w-full max-w-5xl mx-auto px-4 sm:px-6 pt-2 ${
            isKeyboardOpen ? 'pb-72' : 'pb-28'
          }`}
        >
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
      </div>

      {/* Czech Letter Row: Floats directly on top of the iPhone keyboard when an input is focused */}
      {(activeTab === 'table' || activeTab === 'flashcards') && (
        <AccentBar
          activeInputRef={activeInputRef}
          onKeyboardStateChange={setIsKeyboardOpen}
        />
      )}

      {/* Bottom Floating Liquid Glass Tab Bar: Rests right at the bottom of the screen, and stays hidden behind the keyboard when typing */}
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
