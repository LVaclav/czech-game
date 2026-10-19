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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-popup-title"
    >
      <div className="w-full max-w-sm rounded-[34px] p-5 space-y-4 tr-bottom-dock-glass">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-black"
              style={{ color: 'var(--tr-cyan)' }}
            >
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="pwa-popup-title"
                className="text-[17px] font-bold text-white tracking-tight"
              >
                Add to Home Screen
              </h2>
              <p className="text-[13px] text-[#8E8E93]">
                Save Čeština as a full-screen iPhone app.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-black/60 text-[#8E8E93] hover:text-white cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Platform Capsule Switcher */}
        <div className="h-[42px] p-[3px] rounded-full grid grid-cols-2 bg-black/50">
          <button
            type="button"
            onClick={() => setPlatform('ios')}
            className={`rounded-full text-[12px] font-semibold transition-all cursor-pointer ${
              platform === 'ios' ? 'bg-[#26262A]' : ''
            }`}
            style={{
              color: platform === 'ios' ? 'var(--tr-cyan)' : '#8E8E93',
            }}
          >
            iPhone / Safari
          </button>
          <button
            type="button"
            onClick={() => setPlatform('android')}
            className={`rounded-full text-[12px] font-semibold transition-all cursor-pointer ${
              platform === 'android' ? 'bg-[#26262A]' : ''
            }`}
            style={{
              color: platform === 'android' ? 'var(--tr-cyan)' : '#8E8E93',
            }}
          >
            Android / Chrome
          </button>
        </div>

        {platform === 'ios' ? (
          <div className="rounded-[22px] overflow-hidden bg-black/50 text-[14px] text-white">
            <div className="px-4 py-3 flex items-center gap-3 tr-hairline-b">
              <Share
                className="w-4 h-4 shrink-0"
                style={{ color: 'var(--tr-cyan)' }}
              />
              <span>
                1. Tap <strong>Share</strong> in Safari’s bottom bar
              </span>
            </div>
            <div className="px-4 py-3 flex items-center gap-3 tr-hairline-b">
              <PlusSquare
                className="w-4 h-4 shrink-0"
                style={{ color: 'var(--tr-cyan)' }}
              />
              <span>
                2. Tap <strong>Add to Home Screen</strong>
              </span>
            </div>
            <div className="px-4 py-3 flex items-center gap-3">
              <CheckCircle2
                className="w-4 h-4 shrink-0"
                style={{ color: 'var(--tr-green)' }}
              />
              <span>
                3. Tap <strong>Add</strong> in the top-right corner
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-[22px] overflow-hidden bg-black/50 text-[14px] text-white">
            {deferredPrompt && (
              <div className="p-3 tr-hairline-b">
                <button
                  type="button"
                  onClick={handleNativeInstallClick}
                  className="w-full py-2.5 px-4 text-[14px] flex items-center justify-center gap-2 cursor-pointer tr-btn-cyan"
                >
                  <Download className="w-4 h-4" />
                  <span>Install App Now</span>
                </button>
              </div>
            )}
            <div className="px-4 py-3 flex items-center gap-3 tr-hairline-b">
              <MoreVertical
                className="w-4 h-4 shrink-0"
                style={{ color: 'var(--tr-cyan)' }}
              />
              <span>1. Tap the browser menu or install icon</span>
            </div>
            <div className="px-4 py-3 flex items-center gap-3">
              <Download
                className="w-4 h-4 shrink-0"
                style={{ color: 'var(--tr-cyan)' }}
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
          className="w-full py-3 text-[15px] cursor-pointer tr-btn-cyan"
        >
          Done
        </button>
      </div>
    </div>
  );
};
