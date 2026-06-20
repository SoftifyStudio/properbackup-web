import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { fetchArchiveSnapshots, downloadObject } from '../api/bufferClient.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useRecoveryContext } from '../recovery/RecoveryContext.jsx';

function fmtBytes(n) {
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GiB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${n} B`;
}

function fmtSpeed(bytesPerSec) {
  if (bytesPerSec >= 1048576) return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`;
  if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${Math.round(bytesPerSec)} B/s`;
}

function fmtEta(seconds) {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)} mins`;
  return `~${(seconds / 3600).toFixed(1)}h`;
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

/* ── Syncing Icon ── */
function SyncingIcon() {
  return (
    <svg className="w-5 h-5 text-accent tl-spin" viewBox="0 0 20 20" fill="none">
      <path d="M14.5 3.5A7 7 0 003 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M5.5 16.5A7 7 0 0017 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14.5 3.5L14.5 7L11 3.5" fill="currentColor" opacity="0.8"/>
      <path d="M5.5 16.5L5.5 13L9 16.5" fill="currentColor" opacity="0.8"/>
    </svg>
  );
}

/* ── Day Card ── */
const DayCard = memo(function DayCard({ dayKey, dayLabel, snaps, depth, isFirst, filterCount, selectedSnapshot, onSelect, onSetIdx, snapToIdx }) {
  const shrinkPx = depth * 24;
  const opacity = Math.max(0.55, 1 - depth * 0.12);
  const shadowBlur = Math.max(2, 14 - depth * 4);
  const marginTop = depth === 0 ? 0 : -6;

  return (
    <div
      className="transition-all duration-300"
      style={{
        marginLeft: shrinkPx,
        marginRight: shrinkPx,
        marginTop,
        opacity,
        position: 'relative',
        zIndex: 10 - depth,
      }}
    >
      <div
        className="bg-white rounded-xl border border-border overflow-hidden tl-day-card"
        style={{ boxShadow: `0 ${shadowBlur / 2}px ${shadowBlur}px rgba(0,0,0,0.06)` }}
      >
        <div className="px-5 py-3 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-accent" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-bold text-text1">Timeline</span>
          </div>
          {isFirst && (
            <div className="flex items-center gap-3 text-[11px] text-text4">
              <span className="hidden sm:inline">Arrow keys to navigate</span>
              {filterCount > 0 && (
                <span className="text-accent font-bold tl-mono bg-accent/8 px-2 py-0.5 rounded">
                  {(snapToIdx.get(snaps[0]?.objectName) ?? 0) + 1} / {filterCount}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-2 border-b border-border/30 bg-surface/40">
          <span className="text-[11px] font-bold text-text2">{dayLabel}</span>
          <span className="text-[10px] text-text4 ml-2">{snaps.length} snapshot{snaps.length !== 1 ? 's' : ''}</span>
        </div>

        {snaps.map((snap) => {
          const timeStr = formatTimeShort(snap.sealedAt);
          const dateStr = snap.sealedAt
            ? new Date(snap.sealedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : '';
          const isAdd = snap.flag === 'A';
          const isSel = selectedSnapshot?.objectName === snap.objectName;
          const fIdx = snapToIdx.get(snap.objectName) ?? 0;

          return (
            <div
              key={snap.objectName}
              className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-all duration-150 border-b border-border/20 last:border-b-0 ${
                isSel ? 'bg-accentLight/40' : 'hover:bg-surface/60'
              } ${snap._isNew ? 'tl-slide-in' : ''}`}
              onClick={() => {
                onSetIdx(fIdx);
                onSelect(isSel ? null : snap);
              }}
            >
              <div className={`w-3 h-3 rounded-full shrink-0 transition-all ${
                isSel
                  ? 'bg-accent ring-4 ring-accent/20'
                  : isAdd
                    ? 'bg-emerald-500 border-2 border-emerald-500'
                    : 'bg-gray-300 border-2 border-gray-300'
              }`} />

              <span className="text-sm font-semibold text-text1 tabular-nums tl-mono w-20">{timeStr}</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                isAdd ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
              }`}>
                {isAdd ? 'backup' : 'deleted'}
              </span>
              <span className="text-xs text-text4">{dateStr}</span>
              <span className="ml-auto text-xs font-medium text-text3 tl-mono">{fmtBytes(snap.sizeBytes || 0)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ── Timeline Ruler ── */
function TimelineRuler({ dayEntries, onJump, currentDayKey }) {
  if (dayEntries.length === 0) return null;
  const [hoverIdx, setHoverIdx] = useState(null);

  return (
    <div className="relative flex flex-col items-center gap-0" style={{ minWidth: 90, paddingTop: 48 }}>
      <div className="absolute left-[20px] top-12 bottom-4 w-px bg-border" />

      {dayEntries.map(({ dayKey, label, snaps, startIdx }, i) => {
        const isActive = dayKey === currentDayKey;
        const hasDeleted = snaps.some(s => s.flag === 'D');
        const totalSize = snaps.reduce((s, sn) => s + (sn.sizeBytes || 0), 0);

        return (
          <div
            key={dayKey}
            className="relative flex items-center gap-3 w-full cursor-pointer group"
            style={{ height: Math.max(80, snaps.length * 48 + 56) }}
            onClick={() => onJump(startIdx)}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <div className={`relative z-10 w-3 h-3 rounded-full shrink-0 transition-all ${
              isActive
                ? 'bg-accent ring-4 ring-accent/20 scale-125'
                : hasDeleted
                  ? 'bg-orange-400'
                  : 'bg-emerald-500'
            }`} style={{ marginLeft: 14 }} />

            <span className={`text-[11px] whitespace-nowrap transition-colors ${
              isActive ? 'text-accent font-bold' : 'text-text4 group-hover:text-text2'
            }`}>
              {label}
            </span>

            {hoverIdx === i && (
              <div className="absolute left-0 top-full mt-1 z-50
                bg-gray-900 text-white text-[10px] rounded-lg px-3 py-2 shadow-xl whitespace-nowrap
                pointer-events-none tl-tooltip-in" style={{ marginLeft: 8 }}>
                <div className="font-semibold mb-0.5">{label}</div>
                <div>{snaps.length} snapshot{snaps.length !== 1 ? 's' : ''}</div>
                <div className="text-gray-400">Total: {fmtBytes(totalSize)}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Component ── */
export default function SnapshotTimeline({ serverId, onRestore, onSelectSnapshot, selectedSnapshot, verification, sseConnected, latestSnapshot }) {
  const { token } = useAuth();
  const { t, formatDateTime } = useI18n();
  const { startServerRecovery, isRecoveryActive } = useRecoveryContext();
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterFlag, setFilterFlag] = useState('all');
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [downloading, setDownloading] = useState(null);
  const [startingRecovery, setStartingRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState(null);


  const handleDownload = useCallback(async (snap) => {
    if (!token || !snap.objectName) return;
    setDownloading(snap.objectName);
    try {
      const buf = await downloadObject(snap.objectName, token);
      const blob = new Blob([buf], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = snap.objectName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { console.error('Download failed:', e); }
    finally { setDownloading(null); }
  }, [token]);

  const handleStartRecovery = useCallback(async (snap) => {
    if (!snap?.id || isRecoveryActive(serverId)) return;
    setStartingRecovery(true);
    setRecoveryError(null);
    try {
      await startServerRecovery(serverId, snap.id);
    } catch (e) {
      setRecoveryError(e.code === 'RECOVERY_ALREADY_ACTIVE' ? t('recovery.mode.warningRecoveryInProgressOnThisServer') : e.message);
    } finally {
      setStartingRecovery(false);
    }
  }, [serverId, startServerRecovery, isRecoveryActive, t]);

  const load = useCallback(async () => {
    if (!token || !serverId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await fetchArchiveSnapshots(serverId, token, { limit: 2000 });
      const arr = Array.isArray(data) ? data : [];
      arr.sort((a, b) => {
        const ta = a.sealedAt ? new Date(a.sealedAt).getTime() : 0;
        const tb = b.sealedAt ? new Date(b.sealedAt).getTime() : 0;
        return ta - tb;
      });
      setSnapshots(arr);
      if (arr.length > 0) setCurrentIdx(arr.length - 1);
    } catch { setSnapshots([]); }
    finally { setLoading(false); }
  }, [token, serverId]);

  useEffect(() => { load(); }, [load]);



  /* SSE: real-time snapshot creation (received from BackupsPage via prop) */
  useEffect(() => {
    if (!latestSnapshot) return;
    const data = latestSnapshot;
    const newSnap = {
      objectName: data.objectName, pathId: data.pathId, flag: data.flag,
      sizeBytes: data.sizeBytes, sealedAt: data.sealedAt, serverId: data.serverId,
      _isNew: true,
    };
    setSnapshots((prev) => {
      if (prev.some((s) => s.objectName === newSnap.objectName)) return prev;
      const next = [...prev, newSnap];
      next.sort((a, b) => {
        const ta = a.sealedAt ? new Date(a.sealedAt).getTime() : 0;
        const tb = b.sealedAt ? new Date(b.sealedAt).getTime() : 0;
        return ta - tb;
      });
      return next;
    });
    setCurrentIdx((prev) => prev); // stay at current, user can navigate
  }, [latestSnapshot]);

  useEffect(() => {
    if (!snapshots.some((s) => s._isNew)) return;
    const t = setTimeout(() => setSnapshots((p) => p.map((s) => s._isNew ? { ...s, _isNew: false } : s)), 1500);
    return () => clearTimeout(t);
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

  const currentDayKey = useMemo(() => {
    if (!currentSnap?.sealedAt) return '';
    const d = new Date(currentSnap.sealedAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [currentSnap]);

  const navigate = useCallback((dir) => {
    setCurrentIdx((prev) => Math.max(0, Math.min(filtered.length - 1, prev + dir)));
  }, [filtered.length]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { navigate(-1); e.preventDefault(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { navigate(1); e.preventDefault(); }
      if (e.key === 'Enter' && currentSnap) {
        const isSel = selectedSnapshot?.objectName === currentSnap.objectName;
        if (onSelectSnapshot) onSelectSnapshot(isSel ? null : currentSnap);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, currentSnap, onSelectSnapshot, selectedSnapshot]);

  const dayEntries = useMemo(() => {
    const entries = [...dayGroups.entries()];
    entries.reverse();
    let runIdx = filtered.length - 1;
    return entries.map(([dayKey, daySnaps]) => {
      const reversed = [...daySnaps].reverse();
      const startIdx = runIdx;
      runIdx -= daySnaps.length;
      return { dayKey, label: formatDayLabel(dayKey), snaps: reversed, startIdx };
    });
  }, [dayGroups, filtered.length]);

  const snapToIdx = useMemo(() => {
    const m = new Map();
    filtered.forEach((s, i) => m.set(s.objectName, i));
    return m;
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-5 text-xs">
          <span className="text-text3"><span className="font-semibold text-text1">{snapshots.length}</span> snapshots</span>
          <span className="text-text3"><span className="font-semibold text-emerald-600">{activeCount}</span> backups</span>
          {deletedCount > 0 && (
            <span className="text-text3"><span className="font-semibold text-orange-500">{deletedCount}</span> deleted</span>
          )}
          <span className="text-text3">Total: <span className="font-bold text-text1 tl-mono">{fmtBytes(totalSize)}</span></span>
          {sseConnected && (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200/60 rounded-full px-2.5 py-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 tl-live-pulse" />
              <span className="text-[10px] font-bold tracking-wider">Live</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-surface rounded-lg p-0.5 border border-border/50">
            {[
              { key: 'all', label: 'All' },
              { key: 'A', label: 'Backups' },
              { key: 'D', label: 'Deleted' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium ${
                  filterFlag === key ? 'bg-panel text-accent shadow-sm border border-accent/20' : 'text-text3 hover:text-text2'
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
          verification.status === 'passed' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : verification.status === 'failed' ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-surface border-border text-text3'
        }`}>
          <span className="font-semibold">Integrity:</span>{' '}
          {verification.status === 'passed' ? 'Verified' : verification.status === 'failed' ? 'Failed' : verification.status}
          {verification.verifiedAt && <span className="text-text4 ml-2">({formatDateTime(verification.verifiedAt)})</span>}
        </div>
      )}

      {/* Agent status card is now rendered persistently in BackupsPage */}

      {/* Main area: stacked day cards + ruler */}
      <div className="flex gap-0">
        <div className="flex-1 min-w-0">
          {loading && (
            <div className="flex items-center justify-center py-20 text-text4 text-xs gap-2">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              Loading timeline...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-border">
              <svg className="w-14 h-14 mb-3 text-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-sm font-medium text-text3">No snapshots yet</p>
              <p className="text-xs text-text4 mt-1.5 max-w-xs text-center">
                Snapshots will appear here in real-time as the agent creates backups
              </p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="space-y-0">
              {dayEntries.map(({ dayKey, label, snaps, startIdx }, i) => (
                <DayCard
                  key={dayKey}
                  dayKey={dayKey}
                  dayLabel={label}
                  snaps={snaps}
                  depth={Math.min(i, 4)}
                  isFirst={i === 0}
                  filterCount={filtered.length}
                  selectedSnapshot={selectedSnapshot}
                  onSelect={onSelectSnapshot}
                  onSetIdx={setCurrentIdx}
                  snapToIdx={snapToIdx}
                />
              ))}
              {/* Ghost depth cards — show stacking effect even with few days */}
              {dayEntries.length < 3 && Array.from({ length: 3 - dayEntries.length }).map((_, gi) => {
                const ghostDepth = dayEntries.length + gi;
                const shrink = ghostDepth * 24;
                const op = Math.max(0.25, 0.45 - gi * 0.12);
                return (
                  <div
                    key={`ghost-${gi}`}
                    className="transition-all duration-300"
                    style={{
                      marginLeft: shrink,
                      marginRight: shrink,
                      marginTop: -6,
                      opacity: op,
                      position: 'relative',
                      zIndex: 10 - ghostDepth,
                    }}
                  >
                    <div
                      className="bg-white rounded-xl border border-border/60 overflow-hidden"
                      style={{ boxShadow: `0 1px 4px rgba(0,0,0,0.03)` }}
                    >
                      <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-300" viewBox="0 0 20 20" fill="none">
                          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-sm font-bold text-gray-300">Timeline</span>
                      </div>
                      <div className="px-5 py-3">
                        <div className="h-3 w-24 bg-gray-100 rounded" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right ruler */}
        {!loading && filtered.length > 0 && (
          <div className="hidden md:block shrink-0" style={{ width: 110 }}>
            <TimelineRuler
              dayEntries={dayEntries}
              onJump={(idx) => setCurrentIdx(idx)}
              currentDayKey={currentDayKey}
            />
          </div>
        )}
      </div>

      {/* Selected snapshot detail */}
      {selectedSnapshot && (
        <div className="rounded-2xl border-2 border-accent/25 p-5 relative overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-accent ring-4 ring-accent/15" />
                <h3 className="text-sm font-bold text-text1">
                  {selectedSnapshot.sealedAt ? formatDateTime(selectedSnapshot.sealedAt) : 'Unknown time'}
                </h3>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  selectedSnapshot.flag === 'A' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                }`}>
                  {selectedSnapshot.flag === 'A' ? 'Active' : 'Deleted'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs ml-7">
                <div>
                  <span className="text-text4">Size: </span>
                  <span className="font-bold text-text1 tl-mono">{fmtBytes(selectedSnapshot.sizeBytes || 0)}</span>
                </div>
                <div>
                  <span className="text-text4">Archive: </span>
                  <span className="text-text2 tl-mono text-[10px] truncate inline-block max-w-[200px] align-bottom">
                    {selectedSnapshot.objectName}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
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
                    className="tl-restore-btn btn-primary text-xs py-2 px-6 font-semibold relative overflow-hidden"
                    onClick={() => onRestore(selectedSnapshot)}
                  >
                    <span className="relative z-10">Restore</span>
                    <div className="tl-shine absolute inset-0 pointer-events-none" />
                  </button>
                  <button
                    className="tl-restore-btn text-xs py-2 px-4 font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 transition-all"
                    onClick={() => handleStartRecovery(selectedSnapshot)}
                    disabled={startingRecovery || isRecoveryActive(serverId)}
                    title={t('recovery.mode.restoreToThisPoint')}
                  >
                    {startingRecovery ? '...' : t('recovery.mode.restoreToThisPoint')}
                  </button>
                </>
              )}
              {recoveryError && (
                <div className="text-xs text-red-500 mt-1">{recoveryError}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        .tl-mono { font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace; }

        @keyframes tl-segment-pulse-kf {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.82; }
        }
        .tl-segment-pulse { animation: tl-segment-pulse-kf 3s ease-in-out infinite; }

        @keyframes tl-spin-kf { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        .tl-spin { animation: tl-spin-kf 2s linear infinite; }

        @keyframes tl-slide-in-kf {
          0% { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .tl-slide-in { animation: tl-slide-in-kf 0.5s ease-out; }

        @keyframes tl-live-kf {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
        .tl-live-pulse { animation: tl-live-kf 2s ease-in-out infinite; }

        @keyframes tl-tooltip-kf {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tl-tooltip-in { animation: tl-tooltip-kf 0.15s ease-out; }

        .tl-day-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .tl-day-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(15, 108, 189, 0.1) !important;
        }

        @keyframes tl-shine-kf {
          0% { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(200%) skewX(-15deg); }
        }
        .tl-shine::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
          transform: translateX(-100%) skewX(-15deg);
        }
        .tl-restore-btn:hover .tl-shine::after {
          animation: tl-shine-kf 0.75s ease-out;
        }
      `}</style>
    </div>
  );
}
