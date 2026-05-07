import React, { useRef, useEffect, useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

const LEVEL_STYLES = {
  INFO:  'text-text3',
  WARN:  'text-amber-600',
  ERROR: 'text-red-600',
};

const PHASE_META = {
  indexing:    { icon: '🔍', label: 'Scanning',   color: 'text-blue-600',   bg: 'bg-blue-50' },
  uploading:   { icon: '📤', label: 'Uploading',  color: 'text-accent',     bg: 'bg-accent/5' },
  sealing:     { icon: '🔒', label: 'Sealing',    color: 'text-purple-600', bg: 'bg-purple-50' },
  verifying:   { icon: '🛡️', label: 'Verifying',  color: 'text-emerald-600',bg: 'bg-emerald-50' },
  idle:        { icon: '💤', label: 'Idle',        color: 'text-text4',      bg: 'bg-surface' },
  waiting:     { icon: '⏳', label: 'Waiting',     color: 'text-amber-600',  bg: 'bg-amber-50' },
  error:       { icon: '🚨', label: 'Error',       color: 'text-red-600',    bg: 'bg-red-50' },
};

const STATUS_META = {
  current:  { icon: '●', color: 'text-emerald-600', label: 'Synced' },
  changed:  { icon: '◎', color: 'text-amber-600',   label: 'Modified' },
  new:      { icon: '◆', color: 'text-blue-600',    label: 'New file' },
  deleted:  { icon: '✕', color: 'text-red-500',     label: 'Deleted' },
};

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function shortenPath(fullPath) {
  if (!fullPath) return '';
  const parts = fullPath.split('/');
  if (parts.length <= 3) return fullPath;
  return '.../' + parts.slice(-2).join('/');
}

function AgentPhaseBar({ agentStatus }) {
  if (!agentStatus?.phase) return null;
  const phase = agentStatus.phase;
  const meta = PHASE_META[phase] || { icon: '❓', label: phase, color: 'text-text3', bg: 'bg-surface' };

  const hasProgress = agentStatus.scannedFiles != null && agentStatus.totalFiles > 0;
  const pct = hasProgress ? Math.round((agentStatus.scannedFiles / agentStatus.totalFiles) * 100) : 0;

  return (
    <div className={`px-4 py-2.5 ${meta.bg} border-b border-border/50`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{meta.icon}</span>
          <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
          {agentStatus.currentFile && (
            <span className="text-[11px] text-text4 font-mono truncate max-w-[300px]">
              {shortenPath(agentStatus.currentFile)}
            </span>
          )}
        </div>
        {hasProgress && (
          <span className="text-[11px] text-text3 tabular-nums">
            {agentStatus.scannedFiles.toLocaleString()} / {agentStatus.totalFiles.toLocaleString()}
            <span className="text-text4 ml-1">({pct}%)</span>
          </span>
        )}
      </div>
      {hasProgress && (
        <div className="mt-1.5 w-full bg-border/40 rounded-full h-1">
          <div
            className={`h-1 rounded-full transition-all duration-500 ${
              phase === 'indexing' ? 'bg-blue-500' : 'bg-accent'
            }`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry }) {
  const ts = formatTime(entry.ts);

  if (entry.type === 'agentStatus') {
    const meta = PHASE_META[entry.phase] || { icon: '❓', label: entry.phase, color: 'text-text3' };
    return (
      <div className="px-4 py-2 border-b border-border/20 bg-accent/[0.02] animate-slide-in">
        <div className="flex items-start gap-2">
          <span className="text-text4 text-[11px] tabular-nums shrink-0 mt-0.5 w-[60px]">{ts}</span>
          <span className="text-sm">{meta.icon}</span>
          <div className="min-w-0 flex-1">
            <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
            {entry.detail && <span className="text-xs text-text3 ml-1.5">{entry.detail}</span>}
            {entry.currentFile && (
              <div className="text-[11px] text-text4 font-mono truncate mt-0.5">
                → {shortenPath(entry.currentFile)}
              </div>
            )}
            {entry.scannedFiles != null && entry.totalFiles != null && (
              <span className="text-[11px] text-text4 ml-1">
                ({entry.scannedFiles}/{entry.totalFiles})
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (entry.type === 'fileState') {
    const sm = STATUS_META[entry.status] || { icon: '?', color: 'text-text3', label: entry.status };
    const fileName = entry.fullPath?.split('/').pop() || '';
    const dirPath = shortenPath(entry.fullPath?.substring(0, entry.fullPath.lastIndexOf('/')) || '');
    return (
      <div className="px-4 py-1.5 border-b border-border/20 animate-slide-in">
        <div className="flex items-start gap-2">
          <span className="text-text4 text-[11px] tabular-nums shrink-0 mt-0.5 w-[60px]">{ts}</span>
          <span className={`text-xs ${sm.color} shrink-0 mt-0.5`}>{sm.icon}</span>
          <div className="min-w-0 flex-1">
            <span className={`text-xs ${sm.color} font-medium`}>{sm.label}:</span>
            <span className="text-xs text-text1 ml-1 font-medium">{fileName}</span>
            {dirPath && <span className="text-[11px] text-text4 ml-1.5 font-mono">{dirPath}</span>}
          </div>
        </div>
      </div>
    );
  }

  if (entry.type === 'fileStateBatch') {
    return (
      <div className="px-4 py-1.5 border-b border-border/20 animate-slide-in">
        <div className="flex items-center gap-2">
          <span className="text-text4 text-[11px] tabular-nums shrink-0 w-[60px]">{ts}</span>
          <span className="text-xs">📦</span>
          <span className="text-xs text-text3">
            Batch update: <span className="font-semibold text-text1">{entry.count}</span> files
          </span>
        </div>
      </div>
    );
  }

  if (entry.type === 'log') {
    const levelStyle = LEVEL_STYLES[entry.level] || 'text-text3';
    return (
      <div className="px-4 py-1.5 border-b border-border/20 animate-slide-in">
        <div className="flex items-start gap-2">
          <span className="text-text4 text-[11px] tabular-nums shrink-0 mt-0.5 w-[60px]">{ts}</span>
          <span className={`text-[11px] font-semibold shrink-0 mt-0.5 ${levelStyle}`}>[{entry.level}]</span>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] text-text4">[{entry.component}]</span>
            <span className="text-xs text-text2 ml-1">{entry.message}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function ActivityLog({ entries, agentStatus, connected }) {
  const { t } = useI18n();
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (isNearBottom) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [entries.length]);

  const stats = useMemo(() => {
    let files = 0, statuses = 0, logs = 0, phases = 0;
    for (const e of entries) {
      if (e.type === 'fileState') files++;
      else if (e.type === 'fileStateBatch') statuses += (e.count || 0);
      else if (e.type === 'log') logs++;
      else if (e.type === 'agentStatus') phases++;
    }
    return { files, statuses, logs, phases };
  }, [entries]);

  return (
    <div className="rounded-xl2 border border-border bg-panel overflow-hidden shadow-card">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border bg-surface/90 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text1">Activity Log</span>
          {connected && (
            <span className="inline-flex items-center gap-1 text-[10px] text-success font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-text4">
          {stats.phases > 0 && <span>{stats.phases} phases</span>}
          {stats.files > 0 && <span>{stats.files} files</span>}
          {stats.logs > 0 && <span>{stats.logs} logs</span>}
          <span>{entries.length} total</span>
        </div>
      </div>

      {/* Agent phase bar */}
      <AgentPhaseBar agentStatus={agentStatus} />

      {/* Entries */}
      <div ref={scrollRef} className="max-h-[400px] overflow-y-auto">
        {entries.length === 0 && (
          <div className="px-4 py-10 text-center text-text4 text-xs">
            <div className="text-2xl mb-2">{connected ? '📡' : '🔌'}</div>
            {connected ? 'Waiting for agent activity...' : 'Connecting to stream...'}
          </div>
        )}
        {entries.map((entry, i) => (
          <EntryRow key={entry.id || i} entry={entry} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
