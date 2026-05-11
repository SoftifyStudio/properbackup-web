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

function ScanProgressBar({ agentStatus }) {
  if (!agentStatus) return null;
  const { phase, totalFiles, scannedFiles, currentFile } = agentStatus;
  const isScanning = phase === 'indexing' || phase === 'scanning' || phase === 'uploading';
  if (!isScanning || !totalFiles || totalFiles <= 0) return null;

  const pct = Math.min(100, Math.round(((scannedFiles || 0) / totalFiles) * 100));
  const shortFile = currentFile
    ? (currentFile.length > 50 ? '...' + currentFile.slice(-47) : currentFile)
    : '';

  return (
    <div className="rounded-xl border border-indigo-300/40 bg-gradient-to-r from-indigo-950/90 via-slate-900/90 to-indigo-950/90 backdrop-blur-sm p-4 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shadow-md shadow-indigo-400/50" />
          <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">
            Creating Snapshot
          </span>
        </div>
        <span className="text-xs font-bold text-white tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 rounded-full transition-all duration-700 ease-out shadow-md shadow-indigo-500/30"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-indigo-300/80 truncate max-w-[60%]">{shortFile}</span>
        <span className="text-indigo-300/60 tabular-nums">{(scannedFiles || 0).toLocaleString()} / {totalFiles.toLocaleString()} files</span>
      </div>
    </div>
  );
}

function SnapshotCard({ snap, isSelected, isCurrent, depth, onClick }) {
  const timeStr = formatTimeShort(snap.sealedAt);
  const sealDate = snap.sealedAt ? new Date(snap.sealedAt) : null;
  const dateStr = sealDate
    ? sealDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Unknown date';
  const isAdd = snap.flag === 'A';
  const isNew = snap._isNew;

  const scale = Math.max(0.7, 1 - depth * 0.04);
  const translateY = depth * 6;
  const opacity = Math.max(0.25, 1 - depth * 0.08);

  return (
    <div
      className={`relative cursor-pointer transition-all duration-500 ease-out ${isNew ? 'animate-slide-in' : ''}`}
      style={{
        transform: isCurrent ? 'scale(1) translateY(0)' : `scale(${scale}) translateY(${translateY}px)`,
        opacity: isCurrent ? 1 : opacity,
        zIndex: 100 - depth,
      }}
      onClick={onClick}
    >
      <div className={`rounded-xl border-2 p-4 transition-all duration-300 ${
        isSelected
          ? 'border-indigo-400 bg-gradient-to-br from-indigo-950/95 to-slate-900/95 shadow-xl shadow-indigo-500/20 ring-2 ring-indigo-400/30'
          : isCurrent
            ? 'border-indigo-500/40 bg-gradient-to-br from-slate-900/95 to-indigo-950/95 shadow-lg shadow-indigo-500/10 hover:border-indigo-400/60'
            : 'border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-800/80 shadow-md hover:border-slate-600/70'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-3 h-3 rounded-full ${isSelected ? 'bg-indigo-400 shadow-md shadow-indigo-400/50' : isCurrent ? 'bg-indigo-500' : 'bg-slate-500'}`} />
            <span className={`text-sm font-bold ${isSelected ? 'text-white' : isCurrent ? 'text-indigo-200' : 'text-slate-300'}`}>
              {timeStr}
            </span>
          </div>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
            isAdd
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}>
            {isAdd ? 'backup' : 'deleted'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-xs ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
            {dateStr}
          </span>
          <span className={`text-xs font-medium tabular-nums ${isSelected ? 'text-indigo-300' : 'text-slate-500'}`}>
            {fmtBytes(snap.sizeBytes || 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TimelineRuler({ dayGroups, selectedIdx, onJump }) {
  const entries = [...dayGroups.entries()];
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-1 py-2 select-none">
      {entries.map(([dayKey, daySnaps], i) => {
        const startIdx = entries.slice(0, i).reduce((s, [, arr]) => s + arr.length, 0);
        const isActive = selectedIdx >= startIdx && selectedIdx < startIdx + daySnaps.length;
        return (
          <button
            key={dayKey}
            className={`text-[11px] px-2.5 py-1 rounded-md transition-all text-right whitespace-nowrap ${
              isActive
                ? 'bg-indigo-500/30 text-indigo-200 font-bold border border-indigo-400/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
            onClick={() => onJump(startIdx + daySnaps.length - 1)}
          >
            {formatDayLabel(dayKey)}
            <span className="ml-1.5 text-[9px] opacity-60">({daySnaps.length})</span>
          </button>
        );
      })}
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
  const cardStackRef = useRef(null);

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

  useEffect(() => {
    if (currentIdx === -2 && snapshots.length > 0) {
      setCurrentIdx(snapshots.length - 1);
    }
  }, [currentIdx, snapshots.length]);

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
  const currentSnap = filtered[safeIdx] || null;

  const navigate = (dir) => {
    setCurrentIdx((prev) => {
      const next = prev + dir;
      return Math.max(0, Math.min(filtered.length - 1, next));
    });
  };

  const isSnapSelected = (snap) => selectedSnapshot?.objectName === snap.objectName;

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { navigate(1); e.preventDefault(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { navigate(-1); e.preventDefault(); }
      if (e.key === 'Enter' && currentSnap) {
        if (onSelectSnapshot) onSelectSnapshot(isSnapSelected(currentSnap) ? null : currentSnap);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentSnap, filtered.length]);

  const VISIBLE_STACK = 6;
  const stackCards = useMemo(() => {
    if (filtered.length === 0) return [];
    const cards = [];
    for (let i = 0; i < VISIBLE_STACK && (safeIdx - i) >= 0; i++) {
      cards.push({ snap: filtered[safeIdx - i], depth: i });
    }
    return cards;
  }, [filtered, safeIdx]);

  return (
    <div className="space-y-4">
      <ScanProgressBar agentStatus={agentStatus} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-text3">
            <span className="font-semibold text-text1">{snapshots.length}</span> snapshots
          </span>
          <span className="text-text3">
            <span className="font-semibold text-success">{activeCount}</span> backups
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
            <span className="flex items-center gap-1.5 text-emerald-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium">Live</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'A', label: 'Backups' },
              { key: 'D', label: 'Deleted' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  filterFlag === key ? 'bg-accent/15 text-accent font-semibold' : 'text-text3 hover:text-text2 hover:bg-surface/80'
                }`}
                onClick={() => setFilterFlag(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="btn-ghost text-xs py-1 px-2" onClick={load} disabled={loading}>
            {loading ? '...' : 'Refresh'}
          </button>
        </div>
      </div>

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

      <div className="rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
        <div className="relative bg-gradient-to-b from-slate-950 via-indigo-950/80 to-slate-950 min-h-[480px]">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute w-0.5 h-0.5 bg-white rounded-full"
                style={{
                  left: `${(i * 37 + 13) % 100}%`,
                  top: `${(i * 23 + 7) % 100}%`,
                  opacity: 0.1 + (i % 5) * 0.08,
                  animation: `twinkle ${2 + (i % 3)}s ease-in-out ${(i % 4) * 0.5}s infinite alternate`,
                }}
              />
            ))}
          </div>

          <div className="relative z-10 px-6 py-4 border-b border-slate-700/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 10H4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
                <path d="M16 10h-2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
              </svg>
              <h2 className="text-sm font-bold text-white tracking-wide">Time Machine</h2>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Backup History</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="hidden sm:inline">Use arrow keys to navigate</span>
              {filtered.length > 0 && (
                <span className="text-indigo-300 font-medium tabular-nums">
                  {safeIdx + 1} / {filtered.length}
                </span>
              )}
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-24 text-slate-400 text-xs gap-2">
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-300">Entering Time Machine...</span>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <svg className="w-16 h-16 mb-4 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <p className="text-sm font-medium text-slate-400">No snapshots yet</p>
              <p className="text-xs text-slate-600 mt-1.5">Snapshots will appear here in real-time as the agent scans your files</p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="relative z-10 flex gap-6 px-6 py-8">
              <div className="flex-1 flex flex-col items-center justify-center" ref={cardStackRef}>
                <div className="flex items-center gap-6 w-full max-w-md">
                  <button
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                      safeIdx > 0
                        ? 'bg-slate-800/80 hover:bg-indigo-600/40 text-slate-300 hover:text-white border border-slate-600/50 hover:border-indigo-500/50'
                        : 'bg-slate-900/40 text-slate-700 cursor-default border border-slate-800/30'
                    }`}
                    onClick={() => navigate(-1)}
                    disabled={safeIdx <= 0}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none">
                      <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <div className="flex-1 space-y-2">
                    {stackCards.map(({ snap, depth }) => (
                      <SnapshotCard
                        key={snap.objectName || depth}
                        snap={snap}
                        isSelected={isSnapSelected(snap)}
                        isCurrent={depth === 0}
                        depth={depth}
                        onClick={() => {
                          if (depth === 0) {
                            const willSelect = !isSnapSelected(snap);
                            if (onSelectSnapshot) onSelectSnapshot(willSelect ? snap : null);
                          } else {
                            setCurrentIdx(safeIdx - depth);
                          }
                        }}
                      />
                    ))}
                  </div>

                  <button
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                      safeIdx < filtered.length - 1
                        ? 'bg-slate-800/80 hover:bg-indigo-600/40 text-slate-300 hover:text-white border border-slate-600/50 hover:border-indigo-500/50'
                        : 'bg-slate-900/40 text-slate-700 cursor-default border border-slate-800/30'
                    }`}
                    onClick={() => navigate(1)}
                    disabled={safeIdx >= filtered.length - 1}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none">
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                {filtered.length > 1 && (
                  <div className="w-full max-w-md mt-6 px-12">
                    <input
                      type="range"
                      min={0}
                      max={filtered.length - 1}
                      value={safeIdx}
                      onChange={(e) => setCurrentIdx(Number(e.target.value))}
                      className="w-full h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-400
                        [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-indigo-500/40
                        [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-300
                        [&::-webkit-slider-thumb]:hover:bg-indigo-300 [&::-webkit-slider-thumb]:transition-all"
                    />
                    <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                      <span>{formatTimeShort(filtered[0]?.sealedAt)}</span>
                      <span>{'oldest \u2192 newest'}</span>
                      <span>{formatTimeShort(filtered[filtered.length - 1]?.sealedAt)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden lg:block w-36 shrink-0 border-l border-slate-700/40 pl-4">
                <span className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-3 block">Timeline</span>
                <TimelineRuler
                  dayGroups={dayGroups}
                  selectedIdx={safeIdx}
                  onJump={(idx) => setCurrentIdx(idx)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedSnapshot && (
        <div className="rounded-xl border-2 border-indigo-400/40 bg-gradient-to-br from-indigo-50/80 to-slate-50/80 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/30" />
                <h3 className="text-sm font-semibold text-text1">
                  {selectedSnapshot.sealedAt ? formatDateTime(selectedSnapshot.sealedAt) : 'Unknown time'}
                </h3>
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
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
                    className="flex items-center gap-1.5 bg-[#323130] hover:bg-[#323130]/90 text-white font-medium py-2 px-4 rounded-lg text-xs shadow transition-all"
                    onClick={() => handleDownload(selectedSnapshot)}
                    disabled={downloading === selectedSnapshot.objectName}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {downloading === selectedSnapshot.objectName ? 'Downloading...' : 'Download'}
                  </button>
                  <button
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-5 rounded-lg text-xs shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
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
        @keyframes twinkle {
          0% { opacity: 0.1; }
          100% { opacity: 0.4; }
        }
        @keyframes slide-in {
          0% { opacity: 0; transform: scale(0.8) translateY(-20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-slide-in { animation: slide-in 0.6s ease-out; }
      `}</style>
    </div>
  );
}
