import React from 'react';
import { useRecoveryContext } from './RecoveryContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function RecoveryWarningBanner({ currentServerId, onNavigate }) {
  const { t } = useI18n();
  const { activeRecoveries, isRecoveryActive } = useRecoveryContext();

  if (isRecoveryActive(currentServerId)) {
    return (
      <div className="px-4 py-2 bg-yellow-900/40 border-b border-yellow-700/50 text-sm text-yellow-200 flex items-center gap-2">
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1L1 14h14L8 1zm0 4v4m0 2v1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        </svg>
        <span>{t('recovery.mode.warningRecoveryInProgressOnThisServer')}</span>
      </div>
    );
  }

  const others = Array.from(activeRecoveries.entries()).filter(([sid]) => sid !== currentServerId);
  if (others.length === 0) return null;

  return (
    <>
      {others.map(([sid, session]) => (
        <div key={sid} className="px-4 py-2 bg-blue-900/30 border-b border-blue-700/40 text-sm text-blue-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1L1 14h14L8 1zm0 4v4m0 2v1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
            </svg>
            <span>{t('recovery.mode.warningBannerOtherTab', {
              server: sid,
              startTime: session.createdAt ? new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...',
              eta: '—',
            })}</span>
          </div>
          {onNavigate && (
            <button onClick={() => onNavigate(sid)} className="text-xs text-blue-300 hover:text-blue-100 underline">
              {t('recovery.mode.warningBannerOtherTabCta')}
            </button>
          )}
        </div>
      ))}
    </>
  );
}
