import React, { useState, useCallback } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useRecoveryContext } from './RecoveryContext.jsx';
import RecoveryFileSelector from './RecoveryFileSelector.jsx';

/**
 * Modal shown BEFORE calling /recovery/start.
 * Lets user choose: full snapshot restore or partial (selected files).
 * After clicking "Start", calls startRecovery → opens RecoveryConfirmationModal.
 */
export default function RecoveryStartModal({ serverId, snapshot, onStarted, onClose }) {
  const { t, formatDateTime } = useI18n();
  const { token } = useAuth();
  const { startRecovery } = useRecoveryContext();
  const [mode, setMode] = useState('full');
  const [selectedPaths, setSelectedPaths] = useState([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  const handleStart = useCallback(async () => {
    if (!snapshot?.id) return;
    setStarting(true);
    setError(null);
    try {
      const paths = mode === 'partial' ? selectedPaths : null;
      const result = await startRecovery(serverId, snapshot.id, paths);
      onStarted({
        id: result.session_id,
        serverId,
        state: 'REQUESTED',
        selectedPaths: mode === 'partial' ? selectedPaths : null,
      });
    } catch (e) {
      if (e.code === 'RECOVERY_ALREADY_ACTIVE') {
        setError(t('recovery.mode.conflictAlreadyActive'));
      } else {
        setError(e.message);
      }
    } finally {
      setStarting(false);
    }
  }, [snapshot, serverId, mode, selectedPaths, startRecovery, onStarted, t]);

  const canStart = mode === 'full' || (mode === 'partial' && selectedPaths.length > 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-panel rounded-xl2 shadow-modal w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" data-testid="recovery-start-modal">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-text1 font-bold text-lg">{t('recovery.mode.restoreToThisPoint')}</h2>
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text3 hover:bg-surface transition-colors"
            onClick={onClose}
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Snapshot info */}
        <div className="flex items-center gap-3 px-4 py-3 bg-surface/60 rounded-lg border border-border mb-4">
          <svg className="w-5 h-5 text-accent shrink-0" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="text-sm">
            <span className="text-text1 font-semibold">
              {snapshot?.sealedAt ? formatDateTime(snapshot.sealedAt) : 'Snapshot'}
            </span>
            {snapshot?.path && (
              <span className="text-text3 ml-2 font-mono text-xs">{snapshot.path}</span>
            )}
          </div>
        </div>

        {/* Restore mode selector */}
        <div className="mb-4">
          <p className="text-text2 text-sm font-semibold mb-2">{t('recovery.mode.restoreMode')}</p>
          <div className="flex gap-2">
            <button
              className={`flex-1 text-xs px-4 py-2.5 rounded-lg border transition-all ${
                mode === 'full'
                  ? 'border-accent bg-accent/10 text-accent font-semibold'
                  : 'border-border bg-panel text-text3 hover:border-accent/40'
              }`}
              onClick={() => setMode('full')}
            >
              {t('recovery.mode.restoreModeFull')}
            </button>
            <button
              className={`flex-1 text-xs px-4 py-2.5 rounded-lg border transition-all ${
                mode === 'partial'
                  ? 'border-accent bg-accent/10 text-accent font-semibold'
                  : 'border-border bg-panel text-text3 hover:border-accent/40'
              }`}
              onClick={() => setMode('partial')}
            >
              {t('recovery.mode.restoreModePartial')}
            </button>
          </div>
        </div>

        {/* File selector for partial mode */}
        {mode === 'partial' && (
          <div className="mb-4">
            <p className="text-text3 text-xs mb-2">{t('recovery.mode.fileSelector.subtitle')}</p>
            <RecoveryFileSelector
              serverId={serverId}
              snapshot={snapshot}
              selectedPaths={selectedPaths}
              onSelectionChange={setSelectedPaths}
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 mb-4" data-testid="recovery-conflict-error">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button className="btn-ghost text-sm" onClick={onClose} disabled={starting}>
            {t('recovery.mode.confirmModalReject')}
          </button>
          <button
            className="btn-primary text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleStart}
            disabled={!canStart || starting}
          >
            {starting ? '...' : t('recovery.mode.confirmModalAccept')}
          </button>
        </div>
      </div>
    </div>
  );
}
