import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useRecoveryContext } from './RecoveryContext.jsx';

export default function RecoveryCancelModal({ session, onClose }) {
  const { t } = useI18n();
  const { cancelRecovery } = useRecoveryContext();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState(null);

  const handleCancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      await cancelRecovery(session.id);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-panel rounded-xl2 shadow-modal w-full max-w-md p-6">
        <h3 className="text-text1 font-bold text-lg mb-2">
          {t('recovery.mode.cancelConfirmTitle')}
        </h3>
        <p className="text-text3 text-sm mb-5">
          {t('recovery.mode.cancelConfirmBody')}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            className="btn-ghost text-sm"
            onClick={onClose}
            disabled={cancelling}
          >
            {t('recovery.mode.cancelConfirmReject')}
          </button>
          <button
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-5 rounded-lg text-sm shadow transition-all active:scale-[0.98]"
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? '...' : t('recovery.mode.cancelConfirmAccept')}
          </button>
        </div>
      </div>
    </div>
  );
}
