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

      {/* Clean Editorial Header Bar */}
      <header
        className="sticky top-0 z-30 backdrop-blur-md border-b pt-safe transition-colors"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 88%, transparent)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-3">
          {/* Brand Title */}
          <div className="flex items-baseline gap-2.5">
            <span
              className="font-display text-2xl sm:text-3xl tracking-tight leading-none"
              style={{ color: 'var(--text-primary)' }}
            >
              Čeština
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-widest hidden sm:inline"
              style={{ color: 'var(--text-muted)' }}
            >
              Slovesa
            </span>
          </div>

          {/* Desktop Navigation Pills */}
          <nav
            className="hidden md:flex items-center gap-1 p-1 rounded-2xl border theme-subtle"
          >
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
                  className="px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                  style={
                    isActive
                      ? {
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
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

          {/* Right Controls: Style Switcher + Streak + User */}
          <div className="flex items-center gap-2">
            {/* Live Style Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowThemeMenu((prev) => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer theme-subtle"
                style={{ color: 'var(--text-primary)' }}
                title="Switch Visual Theme"
              >
                <span
                  className="w-3 h-3 rounded-full"
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
                    className="absolute right-0 mt-2 w-60 rounded-2xl p-2 border z-50 space-y-1 theme-surface"
                  >
                    <div
                      className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Visual Style
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
                          className="w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer"
                          style={{
                            backgroundColor: selected
                              ? 'var(--accent-soft)'
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
                              className="w-3.5 h-3.5 rounded-full border border-black/15"
                              style={{ backgroundColor: opt.swatchBg }}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full"
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

            {/* Streak Pill */}
            <div
              title={`${progress.stats.currentStreak} day streak • ${progress.stats.tablesCompletedToday} tables today`}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold theme-subtle"
              style={{ color: 'var(--text-primary)' }}
            >
              <Flame
                className="w-3.5 h-3.5"
                style={{ color: 'var(--accent-primary)' }}
              />
              <span>{progress.stats.currentStreak}d</span>
            </div>

            {/* User & Logout */}
            <div className="flex items-center gap-1 pl-1">
              <span
                title={
                  cloudSynced
                    ? `Synced to cloud (${session.username})`
                    : `Saved on device (${session.username})`
                }
                className="text-xs font-semibold px-2 py-1 rounded-lg hidden sm:inline-flex items-center gap-1.5"
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
                className="p-1.5 rounded-xl border transition-colors cursor-pointer theme-subtle"
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
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 pt-5 pb-36 md:pb-24">
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

      {/* Bottom Sticky Dock: Czech AccentBar + Mobile Navigation */}
      <div
        className="fixed bottom-0 inset-x-0 z-30 flex flex-col pb-safe backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
        }}
      >
        {(activeTab === 'table' || activeTab === 'flashcards') && (
          <AccentBar activeInputRef={activeInputRef} />
        )}

        {/* Mobile Bottom Tab Bar */}
        <nav
          className="md:hidden grid grid-cols-3 border-t px-2 py-1.5"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className="flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
            style={{
              color:
                activeTab === 'table'
                  ? 'var(--accent-primary)'
                  : 'var(--text-muted)',
            }}
          >
            <div className="relative">
              <Grid className="w-5 h-5 mb-0.5" />
              {relapsedCount > 0 && (
                <span
                  className="-top-1 -right-2.5 absolute px-1 rounded-full text-[9px] font-black"
                  style={{
                    backgroundColor: 'var(--warn-bg)',
                    color: 'var(--warn-text)',
                    border: '1px solid var(--warn-border)',
                  }}
                >
                  {relapsedCount}
                </span>
              )}
            </div>
            <span>3×2 Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('flashcards')}
            className="flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
            style={{
              color:
                activeTab === 'flashcards'
                  ? 'var(--accent-primary)'
                  : 'var(--text-muted)',
            }}
          >
            <div className="relative">
              <Layers className="w-5 h-5 mb-0.5" />
              {completedCount > 0 && (
                <span
                  className="-top-1 -right-3 absolute px-1 rounded-full text-[9px] font-bold"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  {completedCount}
                </span>
              )}
            </div>
            <span>Flashcards</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className="flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
            style={{
              color:
                activeTab === 'completed'
                  ? 'var(--accent-primary)'
                  : 'var(--text-muted)',
            }}
          >
            <Award className="w-5 h-5 mb-0.5" />
            <span>Words ({completedCount})</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default App;
