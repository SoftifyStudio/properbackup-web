import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { fetchArchiveSnapshots, downloadObject } from '../api/bufferClient.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import useServerEvents from '../api/useServerEvents.js';

function fmtBytes(n) {
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GiB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${n} B`;
}

function groupByDay(snapshots) {
  const groups = new Map();
  for (const snap of snapshots) {
    const d = snap.sealedAt ? new Date(snap.sealedAt) : new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(snap);
  }
  return groups;
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTimeShort(dateStr) {
  if (!dateStr) return '??:??';
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtEta(seconds) {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `~${Math.ceil(seconds)}s remaining`;
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)}m remaining`;
  return `~${(seconds / 3600).toFixed(1)}h remaining`;
}

/* ── Backup Progress Bar (Time Machine style with ETA) ── */
function BackupProgressBar({ agentStatus }) {
  const startRef = useRef(null);
  const [eta, setEta] = useState('');

  const phase = agentStatus?.phase;
  const totalFiles = agentStatus?.totalFiles || 0;
  const scannedFiles = agentStatus?.scannedFiles || 0;
  const currentFile = agentStatus?.currentFile || '';
  const isActive = phase === 'indexing' || phase === 'scanning' || phase === 'uploading';

  useEffect(() => {
    if (!isActive || totalFiles <= 0) { startRef.current = null; return; }
    if (!startRef.current) startRef.current = { time: Date.now(), files: scannedFiles };
    const elapsed = (Date.now() - startRef.current.time) / 1000;
    const done = scannedFiles - startRef.current.files;
    if (done > 5 && elapsed > 2) {
      const rate = done / elapsed;
      const remaining = (totalFiles - scannedFiles) / rate;
      setEta(fmtEta(remaining));
    }
  }, [isActive, scannedFiles, totalFiles]);

  if (!isActive || totalFiles <= 0) return null;

  const pct = Math.min(100, Math.round((scannedFiles / totalFiles) * 100));
  const shortFile = currentFile.length > 55 ? '...' + currentFile.slice(-52) : currentFile;
  const phaseLabel = phase === 'uploading' ? 'Uploading changes' : phase === 'indexing' ? 'Indexing files' : 'Scanning files';

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-semibold text-text1">{phaseLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          {eta && <span className="text-[10px] text-text4">{eta}</span>}
          <span className="text-xs font-bold text-accent tabular-nums">{pct}%</span>
        </div>
      </div>
      <div className="h-2 bg-surface rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-text4 truncate max-w-[60%]">{shortFile}</span>
        <span className="text-text4 tabular-nums">{scannedFiles.toLocaleString()} / {totalFiles.toLocaleString()} files</span>
      </div>
    </div>
  );
}

/* ── Single snapshot row in the timeline list ── */
function SnapshotRow({ snap, isSelected, isCurrent, onClick, formatDateTime }) {
  const timeStr = formatTimeShort(snap.sealedAt);
  const sealDate = snap.sealedAt ? new Date(snap.sealedAt) : null;
  const dateStr = sealDate
    ? sealDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '';
  const isAdd = snap.flag === 'A';
  const isNew = snap._isNew;

  return (
    <div
      className={`group flex items-center gap-4 px-4 py-3 cursor-pointer transition-all duration-200 border-l-3 ${
        isSelected
          ? 'bg-accentLight border-l-accent'
          : isCurrent
            ? 'bg-surface/60 border-l-accent/40 hover:bg-accentLight/50'
            : 'border-l-transparent hover:bg-surface/80'
      } ${isNew ? 'tl-slide-in' : ''}`}
      onClick={onClick}
    >
      {/* Timeline dot */}
      <div className="relative flex flex-col items-center shrink-0" style={{ width: 20 }}>
        <div className={`w-3 h-3 rounded-full border-2 transition-all ${
          isSelected
            ? 'border-accent bg-accent scale-110'
            : isCurrent
              ? 'border-accent bg-white'
              : isAdd
                ? 'border-emerald-400 bg-emerald-50 group-hover:border-accent'
                : 'border-gray-300 bg-gray-100 group-hover:border-accent'
        }`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold tabular-nums ${isSelected ? 'text-accent' : 'text-text1'}`}>
            {timeStr}
          </span>
          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
            isAdd
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-600'
          }`}>
            {isAdd ? 'backup' : 'deleted'}
          </span>
          {dateStr && (
            <span className="text-xs text-text4 hidden sm:inline">{dateStr}</span>
          )}
        </div>
        <span className={`text-xs font-medium tabular-nums ${isSelected ? 'text-accent' : 'text-text3'}`}>
          {fmtBytes(snap.sizeBytes || 0)}
        </span>
      </div>
    </div>
  );
}

export default function SnapshotTimeline({ serverId, onRestore, onSelectSnapshot, selectedSnapshot, verification, agentStatus, sseConnected }) {
  const { token } = useAuth();
  const { formatDateTime } = useI18n();
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterFlag, setFilterFlag] = useState('all');
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [downloading, setDownloading] = useState(null);
  const listRef = useRef(null);

  const handleDownload = useCallback(async (snap) => {
    if (!token || !snap.objectName) return;
    setDownloading(snap.objectName);
    try {
      await downloadObject(snap.objectName, token);
    } catch (e) {
      console.error('Download failed:', e);
    } finally {
      setDownloading(null);
    }
  }, [token]);

  const load = useCallback(async () => {
    if (!token || !serverId) return;
    setLoading(true);
    try {
      const data = await fetchArchiveSnapshots(serverId, token, { limit: 2000 });
      const arr = Array.isArray(data) ? data : [];
      const sorted = arr.sort((a, b) => {
        const ta = a.sealedAt ? new Date(a.sealedAt).getTime() : 0;
        const tb = b.sealedAt ? new Date(b.sealedAt).getTime() : 0;
        return ta - tb;
      });
      setSnapshots(sorted);
      if (sorted.length > 0) setCurrentIdx(sorted.length - 1);
    } catch (e) {
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, [token, serverId]);

  useEffect(() => { load(); }, [load]);

  /* SSE: real-time snapshot creation */
  const sseHandlers = useMemo(() => ({
    onSnapshotCreated: (data) => {
      const newSnap = {
        objectName: data.objectName,
        pathId: data.pathId,
        flag: data.flag,
        sizeBytes: data.sizeBytes,
        sealedAt: data.sealedAt,
        serverId: data.serverId,
        _isNew: true,
      };
      setSnapshots((prev) => {
        const exists = prev.some((s) => s.objectName === newSnap.objectName);
        if (exists) return prev;
        const next = [...prev, newSnap];
        next.sort((a, b) => {
          const ta = a.sealedAt ? new Date(a.sealedAt).getTime() : 0;
          const tb = b.sealedAt ? new Date(b.sealedAt).getTime() : 0;
          return ta - tb;
        });
        return next;
      });
      setCurrentIdx(-2);
    },
  }), []);

  useServerEvents(serverId, sseHandlers, token);

  /* Auto-jump to latest when new snapshot arrives */
  useEffect(() => {
    if (currentIdx === -2 && snapshots.length > 0) {
      setCurrentIdx(snapshots.length - 1);
      if (listRef.current) {
        requestAnimationFrame(() => {
          listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
    }
  }, [currentIdx, snapshots.length]);

  /* Clear _isNew animation flag */
  useEffect(() => {
    const hasNew = snapshots.some((s) => s._isNew);
    if (!hasNew) return;
    const timer = setTimeout(() => {
      setSnapshots((prev) => prev.map((s) => s._isNew ? { ...s, _isNew: false } : s));
    }, 1500);
    return () => clearTimeout(timer);
  }, [snapshots]);

  const filtered = useMemo(() => {
    if (filterFlag === 'all') return snapshots;
    return snapshots.filter((s) => s.flag === filterFlag);
  }, [snapshots, filterFlag]);

  const dayGroups = useMemo(() => groupByDay(filtered), [filtered]);

  const activeCount = snapshots.filter((s) => s.flag === 'A').length;
  const deletedCount = snapshots.filter((s) => s.flag === 'D').length;
  const totalSize = snapshots.reduce((sum, s) => sum + (s.sizeBytes || 0), 0);

  const safeIdx = Math.max(0, Math.min(currentIdx, filtered.length - 1));
  const currentSnap = filtered.length > 0 ? filtered[safeIdx] : null;

  const navigate = useCallback((dir) => {
    setCurrentIdx((prev) => {
      const next = prev + dir;
      return Math.max(0, Math.min(filtered.length - 1, next));
    });
  }, [filtered.length]);

  const isSnapSelected = (snap) => selectedSnapshot?.objectName === snap.objectName;

  /* Keyboard navigation */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowUp') { navigate(-1); e.preventDefault(); }
      if (e.key === 'ArrowDown') { navigate(1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { navigate(-1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { navigate(1); e.preventDefault(); }
      if (e.key === 'Enter' && currentSnap) {
        if (onSelectSnapshot) onSelectSnapshot(isSnapSelected(currentSnap) ? null : currentSnap);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, currentSnap, onSelectSnapshot, selectedSnapshot]);

  /* Build reversed list (newest first, grouped by day) */
  const dayEntries = useMemo(() => {
    const entries = [...dayGroups.entries()];
    entries.reverse();
    return entries.map(([dayKey, daySnaps]) => ({
      dayKey,
      label: formatDayLabel(dayKey),
      snaps: [...daySnaps].reverse(),
    }));
  }, [dayGroups]);

  /* Map: find flatIndex in filtered array for a given snapshot */
  const snapToFilteredIdx = useMemo(() => {
    const m = new Map();
    filtered.forEach((s, i) => m.set(s.objectName, i));
    return m;
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Backup progress bar with ETA */}
      <BackupProgressBar agentStatus={agentStatus} />

      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-text3">
            <span className="font-semibold text-text1">{snapshots.length}</span> snapshots
          </span>
          <span className="text-text3">
            <span className="font-semibold text-emerald-600">{activeCount}</span> backups
          </span>
          {deletedCount > 0 && (
            <span className="text-text3">
              <span className="font-semibold text-text4">{deletedCount}</span> deleted
            </span>
          )}
          <span className="text-text3">
            Total: <span className="font-semibold text-text1">{fmtBytes(totalSize)}</span>
          </span>
          {sseConnected && (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium">Live</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-surface rounded-lg p-0.5">
            {[
              { key: 'all', label: 'All' },
              { key: 'A', label: 'Backups' },
              { key: 'D', label: 'Deleted' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium ${
                  filterFlag === key
                    ? 'bg-panel text-accent shadow-sm'
                    : 'text-text3 hover:text-text2'
                }`}
                onClick={() => setFilterFlag(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="btn-ghost text-xs py-1.5 px-3" onClick={load} disabled={loading}>
            {loading ? '...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Verification */}
      {verification && (
        <div className={`px-4 py-2.5 rounded-xl border text-xs ${
          verification.status === 'passed'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : verification.status === 'failed'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-surface border-border text-text3'
        }`}>
          <span className="font-semibold">Integrity:</span>{' '}
          {verification.status === 'passed' ? 'Verified' : verification.status === 'failed' ? 'Failed' : verification.status}
          {verification.verifiedAt && (
            <span className="text-text4 ml-2">({formatDateTime(verification.verifiedAt)})</span>
          )}
        </div>
      )}

      {/* Timeline list */}
      <div className="card overflow-hidden">
        {/* Timeline header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-semibold text-text1">Timeline</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-text4">
            <span className="hidden sm:inline">Arrow keys to navigate</span>
            {filtered.length > 0 && (
              <span className="text-accent font-semibold tabular-nums">
                {safeIdx + 1} / {filtered.length}
              </span>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-text4 text-xs gap-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Loading timeline...
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <svg className="w-12 h-12 mb-3 text-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <p className="text-sm font-medium text-text3">No snapshots yet</p>
            <p className="text-xs text-text4 mt-1">Snapshots will appear here in real-time as the agent creates backups</p>
          </div>
        )}

        {/* Snapshot list grouped by day (newest first) */}
        {!loading && filtered.length > 0 && (
          <div ref={listRef} className="max-h-[520px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {/* Range slider */}
            {filtered.length > 1 && (
              <div className="px-5 pt-4 pb-2 border-b border-border bg-surface/50">
                <input
                  type="range"
                  min={0}
                  max={filtered.length - 1}
                  value={safeIdx}
                  onChange={(e) => setCurrentIdx(Number(e.target.value))}
                  className="w-full h-1 bg-border rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent
                    [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                    [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                />
                <div className="flex justify-between text-[9px] text-text4 mt-1 tabular-nums">
                  <span>{formatTimeShort(filtered[0]?.sealedAt)}</span>
                  <span>oldest &rarr; newest</span>
                  <span>{formatTimeShort(filtered[filtered.length - 1]?.sealedAt)}</span>
                </div>
              </div>
            )}

            {dayEntries.map(({ dayKey, label, snaps }) => (
              <div key={dayKey}>
                {/* Day header */}
                <div className="sticky top-0 z-10 px-4 py-2 bg-surface/95 backdrop-blur-sm border-b border-border/50 flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-text2">{label}</span>
                  <span className="text-[10px] text-text4">{snaps.length} {snaps.length === 1 ? 'snapshot' : 'snapshots'}</span>
                </div>

                {/* Vertical timeline line + rows */}
                <div className="relative">
                  <div className="absolute left-[29px] top-0 bottom-0 w-px bg-border" />
                  {snaps.map((snap) => {
                    const fIdx = snapToFilteredIdx.get(snap.objectName) ?? 0;
                    return (
                      <SnapshotRow
                        key={snap.objectName}
                        snap={snap}
                        isSelected={isSnapSelected(snap)}
                        isCurrent={fIdx === safeIdx}
                        onClick={() => {
                          setCurrentIdx(fIdx);
                          const willSelect = !isSnapSelected(snap);
                          if (onSelectSnapshot) onSelectSnapshot(willSelect ? snap : null);
                        }}
                        formatDateTime={formatDateTime}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected snapshot detail */}
      {selectedSnapshot && (
        <div className="card border-2 border-accent/30 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full bg-accent" />
                <h3 className="text-sm font-semibold text-text1">
                  {selectedSnapshot.sealedAt ? formatDateTime(selectedSnapshot.sealedAt) : 'Unknown time'}
                </h3>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  selectedSnapshot.flag === 'A' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                }`}>
                  {selectedSnapshot.flag === 'A' ? 'Active' : 'Deleted'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs ml-6">
                <div>
                  <span className="text-text4">Size:</span>
                  <span className="text-text2 ml-1 font-medium">{fmtBytes(selectedSnapshot.sizeBytes || 0)}</span>
                </div>
                <div>
                  <span className="text-text4">Archive:</span>
                  <span className="text-text2 ml-1 font-mono text-[10px] truncate inline-block max-w-[200px] align-bottom">
                    {selectedSnapshot.objectName}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {selectedSnapshot.flag === 'A' && (
                <>
                  <button
                    className="btn-ghost text-xs py-2 px-4 flex items-center gap-1.5"
                    onClick={() => handleDownload(selectedSnapshot)}
                    disabled={downloading === selectedSnapshot.objectName}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {downloading === selectedSnapshot.objectName ? 'Downloading...' : 'Download'}
                  </button>
                  <button
                    className="btn-primary text-xs py-2 px-5"
                    onClick={() => onRestore(selectedSnapshot)}
                  >
                    Restore
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes tl-slide-in-kf {
          0% { opacity: 0; transform: translateX(-12px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .tl-slide-in { animation: tl-slide-in-kf 0.5s ease-out; }
      `}</style>
    </div>
  );
}
