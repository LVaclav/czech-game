import React, { useState } from 'react';
import { Eye, EyeOff, Languages } from 'lucide-react';
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
    <div className="min-h-[100dvh] flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        {/* Native iOS App Icon & Large Title */}
        <div className="text-center space-y-2">
          <div
            className="w-16 h-16 rounded-[16px] flex items-center justify-center mx-auto shadow-sm"
            style={{ backgroundColor: 'var(--ios-blue)', color: '#ffffff' }}
          >
            <Languages className="w-9 h-9" />
          </div>
          <h1 className="font-display text-[28px] leading-tight">Čeština</h1>
          <p
            className="text-[14px]"
            style={{ color: 'var(--ios-label-secondary)' }}
          >
            Czech Verb Conjugation & Flashcards
          </p>
        </div>

        {/* Native iOS UISegmentedControl */}
        <div className="grid grid-cols-2 ios-segmented">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-1.5 px-3 text-[13px] font-semibold transition-all cursor-pointer ${
              mode === 'login' ? 'ios-segmented-active' : ''
            }`}
            style={{
              color:
                mode === 'login'
                  ? 'var(--ios-label)'
                  : 'var(--ios-label-secondary)',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-1.5 px-3 text-[13px] font-semibold transition-all cursor-pointer ${
              mode === 'register' ? 'ios-segmented-active' : ''
            }`}
            style={{
              color:
                mode === 'register'
                  ? 'var(--ios-label)'
                  : 'var(--ios-label-secondary)',
            }}
          >
            Create Account
          </button>
        </div>

        {/* Native iOS Inset Grouped Form Table */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="ios-card overflow-hidden">
            <div className="flex items-center px-4 py-3 ios-hairline-b">
              <label
                htmlFor="auth-username"
                className="w-24 text-[16px] font-normal shrink-0"
              >
                Username
              </label>
              <input
                id="auth-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Required"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                spellCheck={false}
                required
                className="flex-1 bg-transparent text-[17px] outline-none"
              />
            </div>

            <div className="flex items-center px-4 py-3">
              <label
                htmlFor="auth-password"
                className="w-24 text-[16px] font-normal shrink-0"
              >
                Password
              </label>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 4 characters"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                required
                className="flex-1 bg-transparent text-[17px] outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="p-1 cursor-pointer"
                style={{ color: 'var(--ios-label-tertiary)' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="p-3 rounded-[14px] text-[13px] font-medium text-center"
              style={{
                backgroundColor: 'var(--ios-red-bg)',
                color: 'var(--ios-red-text)',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 text-[17px] cursor-pointer ios-btn-blue"
          >
            {loading
              ? 'Signing In…'
              : mode === 'login'
              ? 'Continue'
              : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};
