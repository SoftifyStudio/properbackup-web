import React from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useRecoveryContext } from './RecoveryContext.jsx';

/**
 * Warning banner shown when a recovery is active on ANOTHER server.
 * Displayed in ServersPage and on non-target server tabs (HR-2).
 *
 * @param {string} [excludeServerId] - don't show banner for this server (it's the target)
 * @param {function} [onNavigate] - callback to navigate to the recovering server
 */
export default function RecoveryWarningBanner({ excludeServerId, onNavigate }) {
  const { t, formatDateTime } = useI18n();
  const { activeRecoveries } = useRecoveryContext();

  const otherRecoveries = [];
  for (const [serverId, session] of activeRecoveries) {
    if (serverId !== excludeServerId) {
      otherRecoveries.push(session);
    }
  }

  if (otherRecoveries.length === 0) return null;

  return (
    <div className="space-y-2">
      {otherRecoveries.map((session) => (
        <div
          key={session.id}
          className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs"
        >
          <svg className="w-4 h-4 text-amber-600 shrink-0" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5L14.5 13H1.5L8 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M8 6v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="8" cy="11" r="0.6" fill="currentColor"/>
          </svg>
          <span className="text-amber-800 flex-1">
            {t('recovery.mode.warningBannerOtherTab', {
              server: session.serverId?.slice(0, 8) || '...',
              startTime: session.createdAt ? formatDateTime(session.createdAt, { timeStyle: 'short' }) : '...',
              eta: '...',
            })}
          </span>
          {onNavigate && (
            <button
              className="text-accent font-semibold hover:underline shrink-0"
              onClick={() => onNavigate(session.serverId)}
            >
              {t('recovery.mode.warningBannerOtherTabCta')}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
