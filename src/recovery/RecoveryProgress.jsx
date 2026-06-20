import React, { useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

function fmtBytes(n) {
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GiB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${n} B`;
}

export default function RecoveryProgress({ session, onCancel, loading }) {
  const { t } = useI18n();

  const totalFiles = (session.dryRunFilesToRestore ?? 0) + (session.dryRunFilesToDelete ?? 0);
  const doneFiles = (session.filesRestored ?? 0) + (session.filesDeleted ?? 0);
  const pct = totalFiles > 0 ? Math.min(100, Math.round((doneFiles / totalFiles) * 100)) : 0;

  const etaStr = useMemo(() => {
    if (!session.dryRunTotalBytes || !session.bytesTransferred) return null;
    const remaining = session.dryRunTotalBytes - session.bytesTransferred;
    if (remaining <= 0) return t('recovery.mode.almostDone');
    const speed = session.bytesTransferred / Math.max(1, (Date.now() - new Date(session.startedAt).getTime()) / 1000);
    if (speed <= 0) return null;
    const secs = remaining / speed;
    if (secs < 60) return `~${Math.ceil(secs)}s`;
    if (secs < 3600) return `~${Math.ceil(secs / 60)} min`;
    return `~${(secs / 3600).toFixed(1)}h`;
  }, [session, t]);

  const stateLabel = {
    REQUESTED: t('recovery.mode.stateRequested'),
    PLANNING: t('recovery.mode.statePlanning'),
    AWAITING_USER_CONFIRM: t('recovery.mode.stateAwaitingConfirm'),
    THAWING: t('recovery.mode.stateThawing'),
    READY: t('recovery.mode.stateReady'),
    AGENT_RESTORING: t('recovery.mode.stateRestoring'),
    VERIFYING: t('recovery.mode.stateVerifying'),
    DONE: t('recovery.mode.stateDone'),
    FAILED: t('recovery.mode.stateFailed'),
    CANCELLED: t('recovery.mode.stateCancelled'),
  }[session.state] || session.state;

  const isDone = session.state === 'DONE';
  const isFailed = session.state === 'FAILED';
  const isCancelled = session.state === 'CANCELLED';
  const isTerminal = isDone || isFailed || isCancelled;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        {!isTerminal && (
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
        )}
        {isDone && (
          <svg className="w-5 h-5 text-success shrink-0" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {(isFailed || isCancelled) && (
          <svg className="w-5 h-5 text-danger shrink-0" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
        <span className="text-sm font-semibold text-text1">{stateLabel}</span>
      </div>

      {!isTerminal && (
        <>
          <div>
            <div className="flex justify-between text-xs text-text3 mb-1">
              <span>{doneFiles} / {totalFiles} {t('recovery.mode.files')}</span>
              <span>{pct}%{etaStr ? ` · ETA ${etaStr}` : ''}</span>
            </div>
            <div className="h-3 bg-surface rounded-full overflow-hidden border border-border">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div>
              <div className="text-lg font-bold text-emerald-600">{session.filesRestored ?? 0}</div>
              <div className="text-text4">{t('recovery.mode.restored')}</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-500">{session.filesDeleted ?? 0}</div>
              <div className="text-text4">{t('recovery.mode.deleted')}</div>
            </div>
            <div>
              <div className="text-lg font-bold text-text2">{fmtBytes(session.bytesTransferred ?? 0)}</div>
              <div className="text-text4">{t('recovery.mode.transferred')}</div>
            </div>
          </div>
        </>
      )}

      {isDone && (
        <div className="bg-successLight border border-success/25 rounded-xl2 p-4">
          <p className="text-success text-sm font-semibold">{t('recovery.mode.doneMessage')}</p>
          <p className="text-text2 text-xs mt-1">
            {session.filesRestored ?? 0} {t('recovery.mode.restored')}, {session.filesDeleted ?? 0} {t('recovery.mode.deleted')}, {fmtBytes(session.bytesTransferred ?? 0)} {t('recovery.mode.transferred')}
          </p>
        </div>
      )}

      {isFailed && (
        <div className="bg-dangerLight border border-danger/20 rounded-xl2 p-4">
          <p className="text-danger text-sm font-semibold">{t('recovery.mode.failedMessage')}</p>
          {session.failureReason && <p className="text-text2 text-xs mt-1">{session.failureReason}</p>}
        </div>
      )}

      {isCancelled && (
        <div className="bg-warnLight border border-warn/20 rounded-xl2 p-4">
          <p className="text-warn text-sm font-semibold">{t('recovery.mode.cancelledMessage')}</p>
          {session.cancellationReason && <p className="text-text2 text-xs mt-1">{session.cancellationReason}</p>}
        </div>
      )}

      {!isTerminal && (
        <button
          className="btn-ghost text-xs py-2 px-4 text-danger"
          onClick={onCancel}
          disabled={loading}
        >
          {t('recovery.mode.cancelRestore')}
        </button>
      )}
    </div>
  );
}
