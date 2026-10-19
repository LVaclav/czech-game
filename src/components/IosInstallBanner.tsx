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

interface IosInstallBannerProps {
  forceOpen?: boolean;
  onCloseForceOpen?: () => void;
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

export const IosInstallBanner: React.FC<IosInstallBannerProps> = ({
  forceOpen = false,
  onCloseForceOpen,
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('ios');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent || '';
    const isIos =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);

    if (isIos) {
      setPlatform('ios');
    } else if (isAndroid) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show the Save as PWA pop-up automatically when viewed in a regular browser
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

  const isOpen = showPopup || forceOpen;
  if (!isOpen) return null;

  const handleClose = () => {
    setShowPopup(false);
    onCloseForceOpen?.();
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Ignore storage errors
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-popup-title"
    >
      <div className="w-full max-w-md bg-slate-900 border border-indigo-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-rose-600 flex items-center justify-center shadow-md shrink-0">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 id="pwa-popup-title" className="text-base sm:text-lg font-bold text-white">
                Save as App (PWA)
              </h2>
              <p className="text-xs text-slate-400">
                Add <strong className="text-slate-200">Čeština</strong> to your Home Screen for full-screen mobile practice & offline access.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close popup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Platform Tabs so user can always see iPhone vs Android/Desktop steps */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setPlatform('ios')}
            className={`py-2 px-3 rounded-lg transition-all cursor-pointer ${
              platform === 'ios'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            iPhone / iPad (Safari)
          </button>
          <button
            type="button"
            onClick={() => setPlatform('android')}
            className={`py-2 px-3 rounded-lg transition-all cursor-pointer ${
              platform !== 'ios'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Android / Chrome
          </button>
        </div>

        {/* Step-by-Step Instructions */}
        {platform === 'ios' ? (
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3 text-xs sm:text-sm text-slate-200">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                1
              </span>
              <span className="flex-1">
                Tap the{' '}
                <strong className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
                  <Share className="w-3.5 h-3.5" /> Share
                </strong>{' '}
                button at the bottom of Safari.
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                2
              </span>
              <span className="flex-1">
                Scroll down and tap{' '}
                <strong className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-white border border-slate-700">
                  <PlusSquare className="w-3.5 h-3.5 text-indigo-400" /> Add to Home Screen
                </strong>
                .
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                3
              </span>
              <span className="flex-1">
                Tap <strong className="text-indigo-300">Add</strong> in the top-right corner, then launch <strong>Čeština</strong> from your Home Screen!
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3 text-xs sm:text-sm text-slate-200">
            {deferredPrompt && (
              <button
                type="button"
                onClick={handleNativeInstallClick}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer mb-2"
              >
                <Download className="w-4 h-4" />
                <span>Install App Now (1-Click)</span>
              </button>
            )}

            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                1
              </span>
              <span className="flex-1">
                Tap the browser menu{' '}
                <strong className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-white border border-slate-700">
                  <MoreVertical className="w-3.5 h-3.5" />
                </strong>{' '}
                (or install icon in the address bar).
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                2
              </span>
              <span className="flex-1">
                Select{' '}
                <strong className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-white border border-slate-700">
                  <Download className="w-3.5 h-3.5 text-indigo-400" /> Add to Home Screen / Install App
                </strong>
                .
              </span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Removes browser bars & works offline</span>
          </span>

          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md cursor-pointer shrink-0"
          >
            Got it, continue
          </button>
        </div>
      </div>
    </div>
  );
};
