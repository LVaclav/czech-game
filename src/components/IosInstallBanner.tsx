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

/**
 * Native iOS Modal Sheet for "Add to Home Screen"
 */
export const IosInstallBanner: React.FC = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent || '';
    if (/Android/i.test(ua)) {
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-popup-title"
    >
      <div
        className="w-full max-w-sm rounded-[24px] p-5 pt-3 space-y-4 shadow-2xl"
        style={{ backgroundColor: 'var(--ios-bg-grouped)' }}
      >
        {/* iOS Sheet Grabber */}
        <div
          className="w-9 h-1.5 rounded-full mx-auto"
          style={{ backgroundColor: 'var(--ios-label-tertiary)' }}
        />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--ios-blue)', color: '#ffffff' }}
            >
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="pwa-popup-title"
                className="text-[17px] font-semibold tracking-tight"
              >
                Add to Home Screen
              </h2>
              <p
                className="text-[13px]"
                style={{ color: 'var(--ios-label-secondary)' }}
              >
                Install Čeština as a full-screen iOS app.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer shrink-0"
            style={{
              backgroundColor: 'var(--ios-fill)',
              color: 'var(--ios-label-secondary)',
            }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Native UISegmentedControl */}
        <div className="grid grid-cols-2 ios-segmented">
          <button
            type="button"
            onClick={() => setPlatform('ios')}
            className={`py-1.5 px-3 text-[13px] font-semibold transition-all cursor-pointer ${
              platform === 'ios' ? 'ios-segmented-active' : ''
            }`}
          >
            iPhone / Safari
          </button>
          <button
            type="button"
            onClick={() => setPlatform('android')}
            className={`py-1.5 px-3 text-[13px] font-semibold transition-all cursor-pointer ${
              platform === 'android' ? 'ios-segmented-active' : ''
            }`}
          >
            Android / Chrome
          </button>
        </div>

        {/* iOS Inset Grouped Steps */}
        {platform === 'ios' ? (
          <div className="ios-card overflow-hidden text-[14px]">
            <div className="px-4 py-3 flex items-center gap-3 ios-hairline-b">
              <Share
                className="w-4 h-4 shrink-0"
                style={{ color: 'var(--ios-blue)' }}
              />
              <span>
                1. Tap <strong>Share</strong> in Safari’s bottom bar
              </span>
            </div>
            <div className="px-4 py-3 flex items-center gap-3 ios-hairline-b">
              <PlusSquare
                className="w-4 h-4 shrink-0"
                style={{ color: 'var(--ios-blue)' }}
              />
              <span>
                2. Tap <strong>Add to Home Screen</strong>
              </span>
            </div>
            <div className="px-4 py-3 flex items-center gap-3">
              <CheckCircle2
                className="w-4 h-4 shrink-0"
                style={{ color: 'var(--ios-green)' }}
              />
              <span>
                3. Tap <strong>Add</strong> in the top-right corner
              </span>
            </div>
          </div>
        ) : (
          <div className="ios-card overflow-hidden text-[14px]">
            {deferredPrompt && (
              <div className="p-3 ios-hairline-b">
                <button
                  type="button"
                  onClick={handleNativeInstallClick}
                  className="w-full py-2.5 px-4 text-[14px] flex items-center justify-center gap-2 cursor-pointer ios-btn-blue"
                >
                  <Download className="w-4 h-4" />
                  <span>Install App Now</span>
                </button>
              </div>
            )}
            <div className="px-4 py-3 flex items-center gap-3 ios-hairline-b">
              <MoreVertical
                className="w-4 h-4 shrink-0"
                style={{ color: 'var(--ios-blue)' }}
              />
              <span>1. Tap the browser menu or install icon</span>
            </div>
            <div className="px-4 py-3 flex items-center gap-3">
              <Download
                className="w-4 h-4 shrink-0"
                style={{ color: 'var(--ios-blue)' }}
              />
              <span>
                2. Select <strong>Add to Home Screen</strong>
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleClose}
          className="w-full py-3 text-[16px] cursor-pointer ios-btn-blue"
        >
          Done
        </button>
      </div>
    </div>
  );
};
