import React, { useEffect, useState } from 'react';
import { Bell, Flame, Hand, X } from 'lucide-react';
import { AuthUserSession } from '../types';
import {
  dismissNotificationPromptForSession,
  getNotificationPermissionState,
  isNotificationPromptDismissedThisSession,
  NotificationPermissionState,
  requestAndSubscribeNotifications,
} from '../lib/notifications';

interface NotificationPromptModalProps {
  session: AuthUserSession;
  activeStreak?: number;
  onPermissionChange?: (permission: NotificationPermissionState) => void;
}

export const NotificationPromptModal: React.FC<NotificationPromptModalProps> = ({
  session,
  activeStreak = 0,
  onPermissionChange,
}) => {
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const state = getNotificationPermissionState();
    if (state === 'default' && !isNotificationPromptDismissedThisSession()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    dismissNotificationPromptForSession();
    setVisible(false);
  };

  const handleEnableClick = async () => {
    setSubmitting(true);
    try {
      const { permission } = await requestAndSubscribeNotifications(session);
      onPermissionChange?.(permission);
    } finally {
      setSubmitting(false);
      dismissNotificationPromptForSession();
      setVisible(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-prompt-title"
    >
      <div className="w-full max-w-sm rounded-[34px] p-5 space-y-4 tr-bottom-dock-glass">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-black"
              style={{ color: 'var(--tr-cyan)' }}
            >
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="notif-prompt-title"
                className="text-[17px] font-bold text-white tracking-tight"
              >
                Enable Notifications
              </h2>
              <p className="text-[13px] text-[#8E8E93]">
                {activeStreak > 0
                  ? `Protect your ${activeStreak}-day Czech verb streak.`
                  : 'Build and maintain your daily Czech verb habit.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-black/60 text-[#8E8E93] hover:text-white cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-[22px] overflow-hidden bg-black/50 text-[13.5px] text-white">
          <div className="px-4 py-3.5 flex items-start gap-3 tr-hairline-b">
            <Flame
              className="w-4 h-4 shrink-0 mt-0.5"
              style={{ color: 'var(--tr-cyan)' }}
            />
            <div>
              <div className="font-semibold text-white">
                {activeStreak > 0
                  ? '7:00 PM Streak Reminder'
                  : '7:00 PM Daily Practice Reminder'}
              </div>
              <div className="text-[12px] text-[#8E8E93]">
                {activeStreak > 0
                  ? 'Fires around 7 PM if you haven’t practiced yet to keep your streak alive.'
                  : 'Fires around 7 PM if you haven’t practiced yet to help you start a new streak.'}
              </div>
            </div>
          </div>

          <div className="px-4 py-3.5 flex items-start gap-3">
            <Hand
              className="w-4 h-4 shrink-0 mt-0.5"
              style={{ color: 'var(--tr-cyan)' }}
            />
            <div>
              <div className="font-semibold text-white">Leaderboard Nudges</div>
              <div className="text-[12px] text-[#8E8E93]">
                Get a friendly nudge when friends tell you to keep conjugating!
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-0.5">
          <button
            type="button"
            disabled={submitting}
            onClick={handleEnableClick}
            className="w-full py-3 text-[15px] font-bold cursor-pointer tr-btn-cyan disabled:opacity-60"
          >
            {submitting ? 'Requesting Permission…' : 'Enable Notifications'}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-2.5 text-[13px] font-semibold text-[#8E8E93] hover:text-white cursor-pointer"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};
