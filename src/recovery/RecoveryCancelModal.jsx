import React, { useState } from 'react';
import { useRecoveryContext } from './RecoveryContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function RecoveryCancelModal({ session, onClose }) {
  const { t } = useI18n();
  const { cancelServerRecovery } = useRecoveryContext();
  const [busy, setBusy] = useState(false);

  const handleCancel = async () => {
    setBusy(true);
    try {
      await cancelServerRecovery(session.id, 'User cancelled via UI');
    } catch { /* ignore */ }
    setBusy(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[420px] max-w-[90vw]">
        <div className="bg-panel rounded-xl shadow-lg border border-border p-6">
          <h3 className="text-text1 font-bold mb-3">{t('recovery.mode.cancelConfirmTitle')}</h3>
          <p className="text-sm text-text2 mb-4">{t('recovery.mode.cancelConfirmBody')}</p>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={busy}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
            >
              {busy ? '...' : t('recovery.mode.cancelConfirmAccept')}
            </button>
            <button
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
            >
              {t('recovery.mode.cancelConfirmReject')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
