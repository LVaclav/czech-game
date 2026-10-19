import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award,
  Flame,
  Grid,
  Layers,
  LogOut,
  Palette,
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
  THEME_OPTIONS,
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
  const [showThemeMenu, setShowThemeMenu] = useState(false);

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
          currentTheme={theme}
          onSelectTheme={setTheme}
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

  const activeThemeMeta =
    THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Save as PWA Pop-up Modal (triggers automatically in browser, no top-bar icon) */}
      <IosInstallBanner />

      {/* Native Apple iOS 26 Floating Liquid Glass Top Bar */}
      <header className="sticky top-0 z-30 pt-safe px-3 sm:px-6 pt-2.5">
        <div className="max-w-5xl mx-auto h-14 px-4 rounded-full border flex items-center justify-between gap-3 theme-surface">
          {/* Brand Title */}
          <div className="flex items-center gap-2.5 pl-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs tracking-tight shadow-xs"
              style={{
                background: 'var(--accent-gradient)',
                color: 'var(--accent-primary-fg)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
              }}
            >
              ČJ
            </div>
            <span
              className="font-display text-lg sm:text-xl tracking-tight leading-none"
              style={{ color: 'var(--text-primary)' }}
            >
              Čeština
            </span>
          </div>

          {/* Desktop Capsule Navigation Pills */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-full border theme-subtle">
            {[
              {
                id: 'table' as const,
                label: '3×2 Matrix',
                icon: Grid,
                badge: relapsedCount > 0 ? `${relapsedCount}!` : null,
                isWarn: relapsedCount > 0,
              },
              {
                id: 'flashcards' as const,
                label: 'Flashcards',
                icon: Layers,
                badge: completedCount > 0 ? String(completedCount) : null,
                isWarn: false,
              },
              {
                id: 'completed' as const,
                label: 'Vocabulary',
                icon: Award,
                badge: null,
                isWarn: false,
              },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className="px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                  style={
                    isActive
                      ? {
                          backgroundColor: 'rgba(255, 255, 255, 0.22)',
                          color: 'var(--text-primary)',
                          boxShadow:
                            'inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 8px rgba(0,0,0,0.12)',
                        }
                      : { color: 'var(--text-secondary)' }
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold"
                      style={
                        item.isWarn
                          ? {
                              backgroundColor: 'var(--warn-bg)',
                              color: 'var(--warn-text)',
                              border: '1px solid var(--warn-border)',
                            }
                          : {
                              backgroundColor: 'var(--accent-soft)',
                              color: 'var(--accent-primary)',
                            }
                      }
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Controls: Glass Tint Switcher + Streak + User */}
          <div className="flex items-center gap-2">
            {/* Liquid Glass Tint Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowThemeMenu((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer theme-subtle"
                style={{ color: 'var(--text-primary)' }}
                title="Switch Glass Tint"
              >
                <span
                  className="w-3 h-3 rounded-full border border-white/40"
                  style={{ backgroundColor: activeThemeMeta.swatchAccent }}
                />
                <Palette className="w-3.5 h-3.5 sm:hidden" />
                <span className="hidden sm:inline">{activeThemeMeta.shortName}</span>
              </button>

              {showThemeMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowThemeMenu(false)}
                  />
                  <div
                    className="absolute right-0 mt-2.5 w-64 rounded-3xl p-2.5 border z-50 space-y-1 theme-surface"
                    style={{
                      backgroundColor: 'rgba(18, 34, 62, 0.86)',
                    }}
                  >
                    <div
                      className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Liquid Glass Tint
                    </div>
                    {THEME_OPTIONS.map((opt) => {
                      const selected = opt.id === theme;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setTheme(opt.id);
                            setShowThemeMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-2xl flex items-center justify-between gap-2 transition-all cursor-pointer"
                          style={{
                            backgroundColor: selected
                              ? 'rgba(255, 255, 255, 0.16)'
                              : 'transparent',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <div>
                            <div className="text-xs font-bold">{opt.name}</div>
                            <div
                              className="text-[10px]"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {opt.tagline}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/30"
                              style={{ backgroundColor: opt.swatchBg }}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/30"
                              style={{ backgroundColor: opt.swatchAccent }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Streak Capsule */}
            <div
              title={`${progress.stats.currentStreak} day streak • ${progress.stats.tablesCompletedToday} tables today`}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-bold theme-subtle"
              style={{ color: 'var(--text-primary)' }}
            >
              <Flame
                className="w-3.5 h-3.5"
                style={{ color: 'var(--accent-primary)' }}
              />
              <span>{progress.stats.currentStreak}d</span>
            </div>

            {/* User & Logout */}
            <div className="flex items-center gap-1">
              <span
                title={
                  cloudSynced
                    ? `Synced to cloud (${session.username})`
                    : `Saved on device (${session.username})`
                }
                className="text-xs font-semibold px-2 py-1 rounded-full hidden sm:inline-flex items-center gap-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: cloudSynced
                      ? 'var(--success-text)'
                      : 'var(--text-muted)',
                  }}
                />
                <span className="max-w-[80px] truncate">{session.displayName}</span>
              </span>

              <button
                type="button"
                onClick={handleLogout}
                title={`Log out (${session.displayName})`}
                className="p-2 rounded-full border transition-colors cursor-pointer theme-subtle"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 pt-5 pb-40 md:pb-24">
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

      {/* Bottom Sticky Dock: Czech AccentBar + iOS 26 Floating Liquid Glass Tab Pill */}
      <div className="fixed bottom-0 inset-x-0 z-30 flex flex-col pb-safe pointer-events-none">
        {(activeTab === 'table' || activeTab === 'flashcards') && (
          <div className="pointer-events-auto">
            <AccentBar activeInputRef={activeInputRef} />
          </div>
        )}

        {/* Mobile Floating Liquid Glass Capsule Tab Bar */}
        <div className="md:hidden px-4 pt-2 pb-2.5 pointer-events-auto">
          <nav className="grid grid-cols-3 p-1.5 rounded-full border theme-surface">
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-bold transition-all cursor-pointer"
              style={
                activeTab === 'table'
                  ? {
                      backgroundColor: 'rgba(255, 255, 255, 0.22)',
                      color: 'var(--text-primary)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
                    }
                  : { color: 'var(--text-secondary)' }
              }
            >
              <Grid className="w-4 h-4" />
              <span>Matrix</span>
              {relapsedCount > 0 && (
                <span
                  className="px-1.5 rounded-full text-[10px] font-black"
                  style={{
                    backgroundColor: 'var(--warn-bg)',
                    color: 'var(--warn-text)',
                  }}
                >
                  {relapsedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('flashcards')}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-bold transition-all cursor-pointer"
              style={
                activeTab === 'flashcards'
                  ? {
                      backgroundColor: 'rgba(255, 255, 255, 0.22)',
                      color: 'var(--text-primary)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
                    }
                  : { color: 'var(--text-secondary)' }
              }
            >
              <Layers className="w-4 h-4" />
              <span>Cards</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-bold transition-all cursor-pointer"
              style={
                activeTab === 'completed'
                  ? {
                      backgroundColor: 'rgba(255, 255, 255, 0.22)',
                      color: 'var(--text-primary)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
                    }
                  : { color: 'var(--text-secondary)' }
              }
            >
              <Award className="w-4 h-4" />
              <span>Words ({completedCount})</span>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default App;
