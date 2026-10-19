import React, { useState } from 'react';
import { Eye, EyeOff, Lock, LogIn, Sparkles, User, UserPlus } from 'lucide-react';
import { authenticateUser } from '../lib/api';
import { AuthUserSession } from '../types';

interface AuthViewProps {
  onAuthenticated: (session: AuthUserSession) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthenticated }) => {
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
    <div className="min-h-[100dvh] flex flex-col justify-center items-center px-4 py-10 bg-black text-white">
      <div className="w-full max-w-md space-y-6">
        {/* Title */}
        <div className="px-2">
          <h1 className="font-display text-[38px] leading-tight text-white tracking-tight">
            Čeština
          </h1>
          <p className="text-[15px] text-[#8E8E93]">
            3×2 Czech Verb Conjugation & Priority Flashcards
          </p>
        </div>

        {/* Liquid Glass Capsule Mode Switcher */}
        <div className="h-[56px] p-[4px] rounded-full grid grid-cols-2 items-center tr-bottom-dock-glass">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`h-full rounded-full text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mode === 'login' ? 'tr-bottom-tab-active' : ''
            }`}
            style={{
              color: mode === 'login' ? 'var(--tr-cyan)' : '#ffffff',
            }}
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`h-full rounded-full text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mode === 'register' ? 'tr-bottom-tab-active' : ''
            }`}
            style={{
              color: mode === 'register' ? 'var(--tr-cyan)' : '#ffffff',
            }}
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Main Card */}
        <form onSubmit={handleSubmit} className="tr-card p-6 sm:p-7 space-y-5">
          <div>
            <label
              htmlFor="auth-username"
              className="block text-xs font-bold uppercase tracking-wider text-[#8E8E93] mb-2"
            >
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#8E8E93] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-black border border-white/10 focus:border-[#00E5E5] text-[17px] font-semibold text-white placeholder-[#48484C] outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-bold uppercase tracking-wider text-[#8E8E93] mb-2"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#8E8E93] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                className="w-full pl-11 pr-11 py-3.5 rounded-2xl bg-black border border-white/10 focus:border-[#00E5E5] text-[17px] font-semibold text-white placeholder-[#48484C] outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-[#8E8E93] hover:text-white cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="p-3.5 rounded-2xl text-xs font-semibold text-center"
              style={{
                backgroundColor: 'var(--tr-red-soft)',
                color: 'var(--tr-red)',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-5 text-[16px] flex items-center justify-center gap-2 cursor-pointer tr-btn-cyan"
          >
            {loading ? (
              <span>Signing in…</span>
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In & Load Progress</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
