import React from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

function fmtBytes(n) {
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function fmtDuration(seconds) {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min`;
  return `~${(seconds / 3600).toFixed(1)}h`;
}

const STATE_LABELS = {
  REQUESTED: 'phasePlanning',
  PLANNING: 'phasePlanning',
  AWAITING_USER_CONFIRM: 'phaseAwaitingConfirm',
  THAWING: 'phaseThawing',
  READY: 'phaseReady',
  AGENT_RESTORING: 'phaseRestoring',
  VERIFYING: 'phaseVerifying',
  DONE: 'phaseDone',
  FAILED: 'phaseFailed',
  CANCELLED: 'phaseCancelled',
};

export default function RecoveryProgressCard({ session }) {
  const { t, formatDateTime } = useI18n();

  if (!session) return null;

  const state = session.state;
  const totalFiles = (session.dryRunFilesToRestore ?? 0) + (session.dryRunFilesToDelete ?? 0);
  const doneFiles = (session.filesRestored ?? 0) + (session.filesDeleted ?? 0);
  const pct = totalFiles > 0 ? Math.min(100, Math.round((doneFiles / totalFiles) * 100)) : 0;

  const phaseKey = STATE_LABELS[state] || 'phasePlanning';
  const phaseLabel = state === 'AGENT_RESTORING'
    ? t(`recovery.mode.${phaseKey}`, { done: doneFiles, total: totalFiles })
    : t(`recovery.mode.${phaseKey}`);

  const isActive = !['DONE', 'FAILED', 'CANCELLED'].includes(state);
  const barColor = state === 'FAILED' ? 'bg-red-500'
    : state === 'DONE' ? 'bg-emerald-500'
    : 'bg-accent';

  return (
    <div className="space-y-3">
      <div className="text-sm text-text2">
        {t('recovery.mode.subtitle', {
          server: session.serverId?.slice(0, 8) || '...',
          date: session.createdAt ? formatDateTime(session.createdAt) : '...',
        })}
      </div>

      <div className="flex items-center gap-2 text-xs">
        {isActive && (
          <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
        )}
        <span className={`font-semibold ${state === 'FAILED' ? 'text-red-600' : state === 'DONE' ? 'text-emerald-600' : 'text-accent'}`}>
          {phaseLabel}
        </span>
      </div>

      {(state === 'AGENT_RESTORING' || state === 'VERIFYING') && (
        <>
          <div>
            <div className="flex justify-between text-xs text-text3 mb-1">
              <span>{t('recovery.mode.progressPercent', { percent: pct })}</span>
              <span>{fmtBytes(session.bytesTransferred ?? 0)}</span>
            </div>
            <div className="h-2.5 bg-surface rounded-full overflow-hidden border border-border">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </>
      )}

      {state === 'DONE' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
          {t('recovery.mode.successBody', {
            filesRestored: session.filesRestored ?? 0,
            filesDeleted: session.filesDeleted ?? 0,
          })}
        </div>
      )}

      {state === 'FAILED' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
          {t('recovery.mode.failedBody', { reason: session.failureReason || 'Unknown' })}
        </div>
      )}
    </div>
  );
}
