import React, { useState } from 'react';
import { useRecoveryContext } from './RecoveryContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import RecoveryProgressCard from './RecoveryProgressCard.jsx';
import RecoveryCancelModal from './RecoveryCancelModal.jsx';
import RecoveryConfirmationModal from './RecoveryConfirmationModal.jsx';

export default function RecoveryModeOverlay({ serverId }) {
  const { t } = useI18n();
  const { recoveryForServer } = useRecoveryContext();
  const session = recoveryForServer(serverId);
  const [showCancel, setShowCancel] = useState(false);
  const [minimized, setMinimized] = useState(false);

  if (!session) return null;

  if (session.state === 'AWAITING_USER_CONFIRM') {
    return <RecoveryConfirmationModal serverId={serverId} session={session} />;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 pointer-events-none" />

      <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 ${minimized ? 'w-72' : 'w-[600px] max-w-[90vw]'}`}>
        <div className="bg-panel rounded-xl shadow-lg border-2 border-accent p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3" strokeLinecap="round"/>
                <circle cx="12" cy="12" r="9"/>
              </svg>
              <h2 className="text-text1 font-bold text-lg">{t('recovery.mode.title')}</h2>
            </div>
            <button onClick={() => setMinimized(!minimized)} className="text-xs text-text3 hover:text-text1">
              {minimized ? t('recovery.mode.expand') : t('recovery.mode.minimize')}
            </button>
          </div>

          {!minimized && <RecoveryProgressCard session={session} />}

          <div className="flex gap-3 mt-4">
            {!session.state || !['DONE', 'FAILED', 'CANCELLED', 'VERIFYING'].includes(session.state) ? (
              <button onClick={() => setShowCancel(true)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm">
                {t('recovery.mode.cancel')}
              </button>
            ) : null}
            <button onClick={() => setMinimized(true)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
              {minimized ? t('recovery.mode.expand') : t('recovery.mode.hide')}
            </button>
          </div>
        </div>
      </div>

      {showCancel && (
        <RecoveryCancelModal
          session={session}
          onClose={() => setShowCancel(false)}
        />
      )}
    </>
  );
}
