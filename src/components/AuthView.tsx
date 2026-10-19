import React, { useState } from 'react';
import { Eye, EyeOff, Lock, LogIn, Sparkles, User, UserPlus } from 'lucide-react';
import { authenticateUser } from '../lib/api';
import { THEME_OPTIONS, ThemeId } from '../lib/theme';
import { AuthUserSession } from '../types';

interface AuthViewProps {
  onAuthenticated: (session: AuthUserSession) => void;
  currentTheme: ThemeId;
  onSelectTheme: (theme: ThemeId) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  onAuthenticated,
  currentTheme,
  onSelectTheme,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const session = await authenticateUser(mode, username, password);
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl p-7 sm:p-9 border theme-surface space-y-6">
        {/* Editorial Brand Header */}
        <div className="text-center space-y-1.5">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-1"
            style={{
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent-primary)',
            }}
          >
            <span>Česká Slovesa</span>
          </div>
          <h1
            className="font-display text-4xl sm:text-5xl font-normal tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Čeština
          </h1>
          <p className="text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
            3×2 Conjugation Matrix & Adaptive Flashcards
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl border theme-subtle">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer"
            style={
              mode === 'login'
                ? {
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                  }
                : { color: 'var(--text-secondary)' }
            }
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer"
            style={
              mode === 'register'
                ? {
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                  }
                : { color: 'var(--text-secondary)' }
            }
          >
            <UserPlus className="w-4 h-4" />
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="auth-username"
              className="block text-[11px] font-bold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Username
            </label>
            <div className="relative">
              <User
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                id="auth-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. liam"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                spellCheck={false}
                required
                className="w-full pl-10 pr-4 py-3 rounded-2xl border text-base outline-none transition-all theme-input"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-[11px] font-bold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Password
            </label>
            <div className="relative">
              <Lock
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 4 characters"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                className="w-full pl-10 pr-11 py-3 rounded-2xl border text-base outline-none transition-all theme-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="p-3 rounded-2xl border text-xs font-semibold"
              style={{
                backgroundColor: 'var(--error-bg)',
                borderColor: 'var(--error-border)',
                color: 'var(--error-text)',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 cursor-pointer theme-btn-primary shadow-md"
          >
            {loading ? (
              <span>Signing in...</span>
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>

        {/* Live Style Switcher on Auth Screen */}
        <div className="pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div
            className="text-[10px] font-bold uppercase tracking-widest text-center mb-2.5"
            style={{ color: 'var(--text-muted)' }}
          >
            Pick Your Visual Style
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {THEME_OPTIONS.map((t) => {
              const active = currentTheme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTheme(t.id)}
                  className="flex flex-col items-center gap-1 py-2 px-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-input)',
                    borderColor: active ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span className="flex items-center gap-1">
                    <span
                      className="w-3 h-3 rounded-full border border-black/20"
                      style={{ backgroundColor: t.swatchBg }}
                    />
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: t.swatchAccent }}
                    />
                  </span>
                  <span>{t.shortName}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
