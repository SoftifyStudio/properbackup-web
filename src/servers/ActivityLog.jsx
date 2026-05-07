import React, { useRef, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

const LEVEL_STYLES = {
  INFO:  'text-text3',
  WARN:  'text-amber-600',
  ERROR: 'text-red-600',
};

const PHASE_ICONS = {
  indexing:  { icon: '🔍', label: 'Scanning' },
  uploading: { icon: '📤', label: 'Uploading' },
  idle:      { icon: '✅', label: 'Idle' },
  waiting:   { icon: '⏳', label: 'Waiting' },
};

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ActivityLog({ entries, agentStatus, connected }) {
  const { t } = useI18n();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  const phase = agentStatus?.phase;
  const phaseInfo = PHASE_ICONS[phase] || { icon: '❓', label: phase || 'Unknown' };

  return (
    <div className="rounded-xl2 border border-border bg-panel overflow-hidden shadow-card">
      <div className="px-4 py-2.5 border-b border-border bg-surface/90 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text1">
            {t('backups.activityLogTitle') === 'backups.activityLogTitle' ? 'Activity Log' : t('backups.activityLogTitle')}
          </span>
          {connected && (
            <span className="inline-flex items-center gap-1 text-[10px] text-success font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        {phase && (
          <span className="text-xs text-text3">
            {phaseInfo.icon} {phaseInfo.label}
            {agentStatus?.currentFile && phase === 'indexing' && (
              <span className="ml-2 font-mono text-[11px] text-text4 truncate max-w-[200px] inline-block align-bottom">
                {agentStatus.currentFile.split('/').pop()}
              </span>
            )}
          </span>
        )}
      </div>

      <div className="max-h-[300px] overflow-y-auto font-mono text-xs">
        {entries.length === 0 && (
          <div className="px-4 py-8 text-center text-text4 text-xs">
            {connected
              ? (t('backups.activityLogWaiting') === 'backups.activityLogWaiting' ? 'Waiting for agent activity...' : t('backups.activityLogWaiting'))
              : (t('backups.activityLogDisconnected') === 'backups.activityLogDisconnected' ? 'Connecting to stream...' : t('backups.activityLogDisconnected'))}
          </div>
        )}
        {entries.map((entry, i) => (
          <div
            key={entry.id || i}
            className={`px-4 py-1.5 border-b border-border/30 last:border-0 animate-slide-in ${
              entry.type === 'agentStatus' ? 'bg-accent/[0.03]' : ''
            }`}
          >
            <span className="text-text4 mr-2">{formatTime(entry.ts)}</span>
            {entry.type === 'agentStatus' && (
              <>
                <span className="text-accent font-semibold">[{entry.phase}]</span>
                {entry.detail && <span className="text-text3 ml-1">{entry.detail}</span>}
                {entry.scannedFiles != null && entry.totalFiles != null && (
                  <span className="text-text4 ml-1">
                    ({entry.scannedFiles}/{entry.totalFiles})
                  </span>
                )}
              </>
            )}
            {entry.type === 'fileState' && (
              <>
                <span className={
                  entry.status === 'current' ? 'text-emerald-600' :
                  entry.status === 'changed' ? 'text-amber-600' :
                  entry.status === 'deleted' ? 'text-red-600' :
                  'text-blue-600'
                }>
                  [{entry.status}]
                </span>
                <span className="text-text2 ml-1">{entry.fullPath?.split('/').pop()}</span>
                <span className="text-text4 ml-1 truncate">{entry.fullPath}</span>
              </>
            )}
            {entry.type === 'fileStateBatch' && (
              <span className="text-text3">
                Batch update: <span className="font-semibold text-text2">{entry.count}</span> files
              </span>
            )}
            {entry.type === 'log' && (
              <>
                <span className={LEVEL_STYLES[entry.level] || 'text-text3'}>
                  [{entry.level}]
                </span>
                <span className="text-text3 ml-1">[{entry.component}]</span>
                <span className="text-text2 ml-1">{entry.message}</span>
              </>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
