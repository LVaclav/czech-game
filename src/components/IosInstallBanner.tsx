import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from 'lucide-react';

const DISMISSED_KEY = 'czech_trainer_pwa_popup_dismissed_v1';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function isRunningStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    ('standalone' in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export const IosInstallBanner: React.FC = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    if (isAndroid) {
      setPlatform('android');
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    try {
      const alreadyDismissed = sessionStorage.getItem(DISMISSED_KEY) === '1';
      if (!isRunningStandalonePwa() && !alreadyDismissed) {
        setShowPopup(true);
      }
    } catch {
      if (!isRunningStandalonePwa()) {
        setShowPopup(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!showPopup) return null;

  const handleClose = () => {
    setShowPopup(false);
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Ignore
    }
  };

  const handleNativeInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-popup-title"
    >
      <div
        className="w-full max-w-md rounded-3xl p-5 sm:p-6 border space-y-4 theme-surface"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent-primary)',
                border: '1px solid var(--accent-border)',
              }}
            >
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="pwa-popup-title"
                className="text-lg font-bold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                Save as Home Screen App
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Install <strong>Čeština</strong> as a PWA for a clean, full-screen iPhone experience.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl border transition-colors cursor-pointer shrink-0 theme-subtle"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Close popup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Platform Switcher */}
        <div
          className="grid grid-cols-2 gap-1 p-1 rounded-2xl border text-xs font-semibold theme-subtle"
        >
          <button
            type="button"
            onClick={() => setPlatform('ios')}
            className="py-2 px-3 rounded-xl transition-all cursor-pointer"
            style={
              platform === 'ios'
                ? {
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }
                : { color: 'var(--text-secondary)' }
            }
          >
            iPhone / Safari
          </button>
          <button
            type="button"
            onClick={() => setPlatform('android')}
            className="py-2 px-3 rounded-xl transition-all cursor-pointer"
            style={
              platform === 'android'
                ? {
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }
                : { color: 'var(--text-secondary)' }
            }
          >
            Android / Chrome
          </button>
        </div>

        {platform === 'ios' ? (
          <div
            className="rounded-2xl p-4 border space-y-3 text-xs sm:text-sm theme-input"
          >
            <div className="flex items-center gap-3">
              <span
                className="w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent-primary)',
                }}
              >
                1
              </span>
              <span>
                Tap{' '}
                <strong className="inline-flex items-center gap-1 font-semibold">
                  <Share className="w-3.5 h-3.5 inline" /> Share
                </strong>{' '}
                in Safari’s bottom bar.
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span
                className="w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent-primary)',
                }}
              >
                2
              </span>
              <span>
                Scroll down and tap{' '}
                <strong className="inline-flex items-center gap-1 font-semibold">
                  <PlusSquare className="w-3.5 h-3.5 inline" /> Add to Home Screen
                </strong>
                .
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span
                className="w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent-primary)',
                }}
              >
                3
              </span>
              <span>
                Tap <strong>Add</strong> in the top-right corner to open full-screen.
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-4 border space-y-3 text-xs sm:text-sm theme-input">
            {deferredPrompt && (
              <button
                type="button"
                onClick={handleNativeInstallClick}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer mb-2 theme-btn-primary"
              >
                <Download className="w-4 h-4" />
                <span>Install App Now</span>
              </button>
            )}
            <div className="flex items-center gap-3">
              <span
                className="w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent-primary)',
                }}
              >
                1
              </span>
              <span>
                Tap the browser menu{' '}
                <MoreVertical className="w-3.5 h-3.5 inline" /> or address bar install icon.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent-primary)',
                }}
              >
                2
              </span>
              <span>
                Select <strong>Install App / Add to Home Screen</strong>.
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <span
            className="text-[11px] flex items-center gap-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--success-text)' }} />
            <span>Full-screen & offline ready</span>
          </span>

          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer theme-btn-primary"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
