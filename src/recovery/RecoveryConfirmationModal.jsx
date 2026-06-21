import React, { useState } from 'react';
import { useRecoveryContext } from './RecoveryContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

function fmtBytes(n) {
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GiB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${n} B`;
}

export default function RecoveryConfirmationModal({ serverId, session }) {
  const { t } = useI18n();
  const { confirmServerRecovery, cancelServerRecovery } = useRecoveryContext();
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await confirmServerRecovery(session.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      await cancelServerRecovery(session.id, 'User cancelled at DRY RUN preview');
    } catch { /* ignore */ }
    setBusy(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[560px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <div className="bg-panel rounded-xl shadow-lg border border-border p-6">
          <h2 className="text-text1 font-bold text-lg mb-3">{t('recovery.mode.confirmModalTitle')}</h2>
          <p className="text-sm text-text2 mb-4">{t('recovery.mode.confirmModalIntro')}</p>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-text2">{t('recovery.mode.confirmModalFilesToRestore', {
                count: session.dryRunFilesToRestore || 0,
                size: fmtBytes(session.dryRunTotalBytes || 0),
              })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text2">{t('recovery.mode.confirmModalFilesToDelete', {
                count: session.dryRunFilesToDelete || 0,
                size: '—',
              })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text2">{t('recovery.mode.confirmModalFilesUnchanged', {
                count: session.dryRunFilesUnchanged || 0,
              })}</span>
            </div>
          </div>

          <label className="flex items-start gap-3 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 accent-accent"
            />
            <span className="text-sm text-yellow-200">{t('recovery.mode.confirmModalAcknowledge')}</span>
          </label>

          {error && (
            <div className="p-2 mb-3 bg-red-900/30 border border-red-700 rounded text-sm text-red-300">{error}</div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={!acknowledged || busy}
              className="flex-1 px-4 py-2 bg-accent hover:bg-accent/80 disabled:opacity-40 text-white rounded text-sm font-medium"
            >
              {busy ? '...' : t('recovery.mode.confirmModalAccept')}
            </button>
            <button
              onClick={handleCancel}
              disabled={busy}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
            >
              {t('recovery.mode.confirmModalReject')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
