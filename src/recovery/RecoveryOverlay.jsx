import React from 'react';
import { useRecoverySession } from './RecoverySessionContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

const STATE_INFO = {
  REQUESTED: { icon: 'clock', color: 'text-accent', labelKey: 'recovery.state.requested' },
  PLANNING: { icon: 'scan', color: 'text-accent', labelKey: 'recovery.state.planning' },
  AWAITING_USER_CONFIRM: { icon: 'check', color: 'text-warning', labelKey: 'recovery.state.awaitingConfirm' },
  THAWING: { icon: 'thaw', color: 'text-accent', labelKey: 'recovery.state.thawing' },
  READY: { icon: 'ready', color: 'text-success', labelKey: 'recovery.state.ready' },
  AGENT_RESTORING: { icon: 'restore', color: 'text-accent', labelKey: 'recovery.state.agentRestoring' },
  VERIFYING: { icon: 'verify', color: 'text-accent', labelKey: 'recovery.state.verifying' },
  DONE: { icon: 'done', color: 'text-success', labelKey: 'recovery.state.done' },
  FAILED: { icon: 'error', color: 'text-danger', labelKey: 'recovery.state.failed' },
  CANCELLED: { icon: 'cancel', color: 'text-text3', labelKey: 'recovery.state.cancelled' },
};

function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-text3 mb-1">
        <span>{current} / {total} files</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * HR-3: Time-Machine UX — center-screen overlay with progress.
 * Shows recovery state, progress bar, ETA, and cancel button.
 */
export default function RecoveryOverlay() {
  const { session, cancel, confirm, dismiss, loading, isActive } = useRecoverySession();
  const { t } = useI18n();

  if (!session) return null;

  const stateInfo = STATE_INFO[session.state] || STATE_INFO.REQUESTED;
  const isTerminal = ['DONE', 'FAILED', 'CANCELLED'].includes(session.state);
  const showProgress = session.state === 'AGENT_RESTORING';
  const showConfirm = session.state === 'AWAITING_USER_CONFIRM';
  const canCancel = !isTerminal && session.state !== 'VERIFYING';

  const totalFiles = (session.dry_run_files_to_restore || 0) + (session.dry_run_files_to_delete || 0);
  const completedFiles = (session.files_restored || 0) + (session.files_deleted || 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-panel rounded-xl2 shadow-modal w-full max-w-lg p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-text1 font-bold text-lg">
            {t('recovery.overlay.title')}
          </h2>
          {isTerminal && (
            <button onClick={dismiss} className="w-8 h-8 flex items-center justify-center rounded-lg text-text3 hover:bg-surface">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* State badge */}
        <div className={`flex items-center gap-2 ${stateInfo.color}`}>
          <div className="w-3 h-3 rounded-full bg-current animate-pulse" />
          <span className="font-medium text-sm">{t(stateInfo.labelKey)}</span>
        </div>

        {/* Snapshot info */}
        {session.target_snapshot_id && (
          <div className="text-xs text-text3">
            Snapshot #{session.target_snapshot_id} • Server: {session.server_id?.slice(0, 8)}...
          </div>
        )}

        {/* DRY RUN preview (HR-4) */}
        {showConfirm && (
          <div className="bg-warningLight border border-warning/20 rounded-xl2 p-4 space-y-3">
            <p className="text-warning text-sm font-semibold">{t('recovery.overlay.dryRunTitle')}</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-text1">{session.dry_run_files_to_restore || 0}</div>
                <div className="text-xs text-text3">{t('recovery.overlay.toRestore')}</div>
              </div>
              <div>
                <div className="text-lg font-bold text-danger">{session.dry_run_files_to_delete || 0}</div>
                <div className="text-xs text-text3">{t('recovery.overlay.toDelete')}</div>
              </div>
              <div>
                <div className="text-lg font-bold text-text3">{session.dry_run_files_unchanged || 0}</div>
                <div className="text-xs text-text3">{t('recovery.overlay.unchanged')}</div>
              </div>
            </div>
            <div className="text-xs text-text3">
              {t('recovery.overlay.totalBytes')}: {formatBytes(session.dry_run_total_bytes)}
            </div>
            <button
              onClick={confirm}
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? t('common.loading') : t('recovery.overlay.confirmRestore')}
            </button>
          </div>
        )}

        {/* Progress bar (HR-3) */}
        {showProgress && (
          <div className="space-y-2">
            <ProgressBar current={completedFiles} total={totalFiles} />
            <div className="text-xs text-text3">
              {formatBytes(session.bytes_transferred || 0)} transferred
            </div>
          </div>
        )}

        {/* Terminal state messages */}
        {session.state === 'DONE' && (
          <div className="bg-successLight border border-success/25 rounded-xl2 p-4">
            <p className="text-success text-sm font-semibold">{t('recovery.overlay.doneTitle')}</p>
            <p className="text-text2 text-sm mt-1">{t('recovery.overlay.doneBody')}</p>
          </div>
        )}

        {session.state === 'FAILED' && (
          <div className="bg-dangerLight border border-danger/20 rounded-xl2 p-4">
            <p className="text-danger text-sm font-semibold">{t('recovery.overlay.failedTitle')}</p>
            <p className="text-text2 text-sm mt-1">{session.failure_reason || t('recovery.overlay.failedBody')}</p>
          </div>
        )}

        {session.state === 'CANCELLED' && (
          <div className="bg-surface border border-border rounded-xl2 p-4">
            <p className="text-text3 text-sm font-semibold">{t('recovery.overlay.cancelledTitle')}</p>
          </div>
        )}

        {/* Cancel button (HR-9) */}
        {canCancel && (
          <button
            onClick={() => cancel()}
            disabled={loading}
            className="btn-ghost text-danger text-sm w-full"
          >
            {t('recovery.overlay.cancelBtn')}
          </button>
        )}
      </div>
    </div>
  );
}
