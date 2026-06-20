import React from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

function fmtBytes(n) {
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GiB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${n} B`;
}

function fmtEta(seconds) {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min`;
  return `~${(seconds / 3600).toFixed(1)}h`;
}

function phaseKey(state) {
  const map = {
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
  return map[state] || 'phasePlanning';
}

export default function RecoveryProgressCard({ session }) {
  const { t } = useI18n();
  if (!session) return null;

  const total = (session.dryRunFilesToRestore || 0) + (session.dryRunFilesToDelete || 0);
  const done = (session.filesRestored || 0) + (session.filesDeleted || 0);
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  const isTerminal = ['DONE', 'FAILED', 'CANCELLED'].includes(session.state);
  const isRestoring = session.state === 'AGENT_RESTORING';

  const phaseText = isRestoring
    ? t('recovery.mode.phaseRestoring', { done, total })
    : t(`recovery.mode.${phaseKey(session.state)}`);

  return (
    <div className="space-y-3">
      <div className="text-sm text-text2">
        {t('recovery.mode.subtitle', {
          server: session.serverId,
          date: session.createdAt ? new Date(session.createdAt).toLocaleString() : '...',
        })}
      </div>

      <div className="text-sm font-medium text-text1">{phaseText}</div>

      {(isRestoring || session.state === 'VERIFYING') && (
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className="bg-accent h-3 rounded-full transition-all duration-500"
            style={{ width: `${session.state === 'VERIFYING' ? 100 : pct}%` }}
          />
        </div>
      )}

      {isRestoring && total > 0 && (
        <div className="text-xs text-text3">
          {t('recovery.mode.progressPercent', { percent: pct })}
          {session.dryRunTotalBytes ? ` — ${fmtBytes(session.bytesTransferred || 0)} / ${fmtBytes(session.dryRunTotalBytes)}` : ''}
        </div>
      )}

      {isTerminal && session.state === 'DONE' && (
        <div className="p-3 bg-green-900/30 border border-green-700 rounded text-sm text-green-300">
          {t('recovery.mode.successTitle')}
          <div className="text-xs mt-1">
            {t('recovery.mode.successBody', {
              filesRestored: session.filesRestored || 0,
              filesDeleted: session.filesDeleted || 0,
            })}
          </div>
        </div>
      )}

      {session.state === 'FAILED' && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded text-sm text-red-300">
          {t('recovery.mode.failedTitle')}
          <div className="text-xs mt-1">
            {t('recovery.mode.failedBody', { reason: session.failureReason || 'unknown' })}
          </div>
        </div>
      )}
    </div>
  );
}
