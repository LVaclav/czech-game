import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award,
  Cloud,
  CloudOff,
  Flame,
  Grid,
  Layers,
  LogOut,
  Smartphone,
  User,
} from 'lucide-react';
import { AuthUserSession, UserProgressBlob } from './types';
import {
  clearSession,
  fetchUserProgress,
  getSavedSession,
  loadLocalProgress,
  syncUserProgress,
} from './lib/api';
import { VERB_MAP } from './lib/priorityQueue';
import { AuthView } from './components/AuthView';
import { TableTrainerView } from './components/TableTrainerView';
import { FlashcardView } from './components/FlashcardView';
import { CompletedListView } from './components/CompletedListView';
import { AccentBar } from './components/AccentBar';
import {
  IosInstallBanner,
  isRunningStandalonePwa,
} from './components/IosInstallBanner';

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
  const [showPwaModal, setShowPwaModal] = useState<boolean>(false);
  const [isStandalone] = useState<boolean>(() => isRunningStandalonePwa());

  const activeInputRef = useRef<HTMLInputElement | null>(null);

  // Sync user's progress with Netlify Blobs when session becomes active
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
        <IosInstallBanner
          forceOpen={showPwaModal}
          onCloseForceOpen={() => setShowPwaModal(false)}
        />
        <AuthView
          onAuthenticated={(newSession) => {
            setSession(newSession);
            setProgress(loadLocalProgress(newSession.username));
          }}
          onOpenPwaInstructions={() => setShowPwaModal(true)}
          showInstallButton={!isStandalone}
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

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-950 text-slate-100">
      {/* Save as PWA Pop-up Modal (triggers automatically in browser + reopenable from header) */}
      <IosInstallBanner
        forceOpen={showPwaModal}
        onCloseForceOpen={() => setShowPwaModal(false)}
      />

      {/* Top Navigation & User Bar (respects iPhone safe-area-inset-top) */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 pt-safe">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          {/* App Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-rose-600 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-xs font-black text-white">ČJ</span>
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-white leading-tight">
                Čeština
              </h1>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                3×2 Verb Conjugation & Priority Flashcards
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'table'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>3×2 Table Trainer</span>
              {relapsedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-200">
                  {relapsedCount}!
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('flashcards')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'flashcards'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Flashcards</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {completedCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>My Words</span>
            </button>
          </nav>

          {/* Right Stats, Save as PWA Button & Multi-User Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isStandalone && (
              <button
                type="button"
                onClick={() => setShowPwaModal(true)}
                title="How to save as full-screen Home Screen app (PWA)"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 text-xs font-bold text-indigo-300 transition-colors cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Save as App</span>
                <span className="sm:hidden">PWA</span>
              </button>
            )}

            <div
              title="Daily streak & tables completed today"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-amber-300"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
              <span>{progress.stats.currentStreak}d</span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-slate-300 hidden sm:inline">
                {progress.stats.tablesCompletedToday} today
              </span>
            </div>

            <div className="flex items-center gap-1.5 pl-1.5 sm:pl-2 border-l border-slate-800">
              <span
                title={
                  cloudSynced
                    ? `Synced to Netlify Blobs (progress:${session.username})`
                    : `Saved locally on device (${session.username})`
                }
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800"
              >
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span className="max-w-[75px] truncate">{session.displayName}</span>
                {cloudSynced ? (
                  <Cloud className="w-3 h-3 text-emerald-400 ml-0.5" />
                ) : (
                  <CloudOff className="w-3 h-3 text-slate-500 ml-0.5" />
                )}
              </span>

              <button
                type="button"
                onClick={handleLogout}
                title="Switch User / Log Out"
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 transition-colors cursor-pointer"
                aria-label="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 pt-4 pb-36 md:pb-24">
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

      {/* Bottom Sticky Dock: Czech AccentBar (on typing tabs) + Mobile Tab Bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 flex flex-col pb-safe bg-slate-950/95 backdrop-blur-md">
        {(activeTab === 'table' || activeTab === 'flashcards') && (
          <AccentBar activeInputRef={activeInputRef} />
        )}

        {/* Mobile Bottom Tab Bar */}
        <nav className="md:hidden grid grid-cols-3 border-t border-slate-800/90 bg-slate-950 px-2 py-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
              activeTab === 'table' ? 'text-indigo-400' : 'text-slate-400'
            }`}
          >
            <div className="relative">
              <Grid className="w-5 h-5 mb-0.5" />
              {relapsedCount > 0 && (
                <span className="-top-1 -right-2.5 absolute px-1 rounded-full text-[9px] bg-amber-500 text-slate-950 font-black">
                  {relapsedCount}
                </span>
              )}
            </div>
            <span>3×2 Trainer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('flashcards')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
              activeTab === 'flashcards' ? 'text-indigo-400' : 'text-slate-400'
            }`}
          >
            <div className="relative">
              <Layers className="w-5 h-5 mb-0.5" />
              {completedCount > 0 && (
                <span className="-top-1 -right-3 absolute px-1 rounded-full text-[9px] bg-slate-800 text-slate-200 border border-slate-700">
                  {completedCount}
                </span>
              )}
            </div>
            <span>Flashcards</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
              activeTab === 'completed' ? 'text-indigo-400' : 'text-slate-400'
            }`}
          >
            <Award className="w-5 h-5 mb-0.5" />
            <span>My Words ({completedCount})</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default App;
