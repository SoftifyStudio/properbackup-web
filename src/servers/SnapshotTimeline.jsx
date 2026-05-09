import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { fetchArchiveSnapshots, downloadObject } from '../api/bufferClient.js';
import { useI18n } from '../i18n/I18nContext.jsx';

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

function TimelineDot({ snap, isSelected, onClick, formatDateTime }) {
  const sealDate = snap.sealedAt ? new Date(snap.sealedAt) : null;
  const timeStr = sealDate
    ? sealDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '??:??';
  const isAdd = snap.flag === 'A';

  return (
    <div
      className="flex flex-col items-center cursor-pointer group shrink-0"
      style={{ width: 80 }}
      onClick={onClick}
      title={sealDate ? formatDateTime(snap.sealedAt) : 'Unknown'}
    >
      <span className={`text-[10px] font-medium mb-1.5 transition-colors ${
        isSelected ? 'text-accent' : 'text-text4 group-hover:text-text2'
      }`}>
        {timeStr}
      </span>

      <div className="relative z-10">
        <div className={`w-4 h-4 rounded-full border-2 transition-all ${
          isSelected
            ? 'border-accent bg-accent scale-125 shadow-lg shadow-accent/30'
            : isAdd
              ? 'border-emerald-400 bg-emerald-400/20 group-hover:scale-110 group-hover:border-accent'
              : 'border-gray-400 bg-gray-200 group-hover:scale-110 group-hover:border-accent'
        }`} />
        {isSelected && (
          <div className="absolute -inset-1 rounded-full bg-accent/20 animate-ping" />
        )}
      </div>

      <span className={`text-[9px] mt-1.5 transition-colors ${
        isSelected ? 'text-accent font-semibold' : 'text-text4 group-hover:text-text3'
      }`}>
        {fmtBytes(snap.sizeBytes || 0)}
      </span>

      <span className={`text-[8px] font-bold mt-0.5 uppercase ${
        isAdd ? 'text-emerald-500' : 'text-red-400'
      }`}>
        {isAdd ? 'scan' : 'del'}
      </span>
    </div>
  );
}

export default function SnapshotTimeline({ serverId, onRestore, onSelectSnapshot, selectedSnapshot, verification }) {
  const { token } = useAuth();
  const { formatDateTime } = useI18n();
  const scrollRef = useRef(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterFlag, setFilterFlag] = useState('all');
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ x: 0, scrollLeft: 0, moved: false });
  const [downloading, setDownloading] = useState(null);

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
    } catch (e) {
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, [token, serverId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading && snapshots.length > 0 && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      });
    }
  }, [loading, snapshots.length]);

  const filtered = useMemo(() => {
    if (filterFlag === 'all') return snapshots;
    return snapshots.filter((s) => s.flag === filterFlag);
  }, [snapshots, filterFlag]);

  const dayGroups = useMemo(() => groupByDay(filtered), [filtered]);

  const activeCount = snapshots.filter((s) => s.flag === 'A').length;
  const deletedCount = snapshots.filter((s) => s.flag === 'D').length;
  const totalSize = snapshots.reduce((sum, s) => sum + (s.sizeBytes || 0), 0);

  const handleMouseDown = (e) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    dragRef.current = { x: e.pageX, scrollLeft: scrollRef.current.scrollLeft, moved: false };
    scrollRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const dx = e.pageX - dragRef.current.x;
    if (Math.abs(dx) > 3) dragRef.current.moved = true;
    scrollRef.current.scrollLeft = dragRef.current.scrollLeft - dx;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab';
  };

  const scrollTimeline = (dir) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' });
  };

  const isSnapSelected = (snap) => selectedSnapshot?.objectName === snap.objectName;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-text3">
            <span className="font-semibold text-text1">{snapshots.length}</span> snapshots
          </span>
          <span className="text-text3">
            <span className="font-semibold text-success">{activeCount}</span> scans
          </span>
          {deletedCount > 0 && (
            <span className="text-text3">
              <span className="font-semibold text-text4">{deletedCount}</span> deleted
            </span>
          )}
          <span className="text-text3">
            Total: <span className="font-semibold text-text1">{fmtBytes(totalSize)}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'A', label: 'Scans' },
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

      {/* Verification status */}
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

      {/* Horizontal scrollable timeline */}
      <div className="rounded-xl border border-border bg-panel overflow-hidden shadow-sm">
        {/* Timeline header */}
        <div className="px-4 py-2.5 border-b border-border bg-gradient-to-r from-surface/90 to-surface/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-semibold text-text2">Backup Timeline</span>
            <span className="text-[10px] text-text4 ml-1">drag to scroll</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface/80 text-text3 hover:text-text1 transition-colors"
              onClick={() => scrollTimeline(-1)}
              title="Scroll left (older)"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface/80 text-text3 hover:text-text1 transition-colors"
              onClick={() => scrollTimeline(1)}
              title="Scroll right (newer)"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12 text-text4 text-xs gap-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Loading timeline...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-text4">
            <svg className="w-10 h-10 mb-3 text-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <p className="text-sm font-medium text-text3">No snapshots yet</p>
            <p className="text-xs text-text4 mt-1">Snapshots will appear here after each scan</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="relative">
            {/* Scrollable area */}
            <div
              ref={scrollRef}
              className="overflow-x-auto overflow-y-hidden py-6 px-6 select-none"
              style={{ cursor: 'grab', scrollbarWidth: 'thin' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div className="flex items-start gap-0" style={{ minWidth: 'max-content' }}>
                {[...dayGroups.entries()].map(([dayKey, daySnaps], dayIdx) => (
                  <div key={dayKey} className="flex flex-col items-start shrink-0">
                    {/* Day label */}
                    <div className="flex items-center gap-2 mb-4 px-2">
                      <span className="text-[11px] font-semibold text-text2 whitespace-nowrap bg-surface/80 px-2 py-0.5 rounded-md border border-border/50">
                        {formatDayLabel(dayKey)}
                      </span>
                      <span className="text-[10px] text-text4">
                        {daySnaps.length} {daySnaps.length === 1 ? 'scan' : 'scans'}
                      </span>
                    </div>

                    {/* Day's snapshots with connecting line */}
                    <div className="relative flex items-start">
                      {/* Horizontal connecting line */}
                      {daySnaps.length > 1 && (
                        <div
                          className="absolute top-[34px] left-[40px] h-[2px] bg-gradient-to-r from-border via-border to-border/50"
                          style={{ width: `${(daySnaps.length - 1) * 80}px` }}
                        />
                      )}

                      {daySnaps.map((snap, snapIdx) => (
                        <TimelineDot
                          key={snap.objectName || snapIdx}
                          snap={snap}
                          isSelected={isSnapSelected(snap)}
                          onClick={() => {
                            if (dragRef.current.moved) return;
                            const willSelect = !isSnapSelected(snap);
                            if (onSelectSnapshot) onSelectSnapshot(willSelect ? snap : null);
                          }}
                          formatDateTime={formatDateTime}
                        />
                      ))}
                    </div>

                    {/* Day separator */}
                    {dayIdx < dayGroups.size - 1 && (
                      <div className="flex items-center self-center" style={{ marginTop: -28 }}>
                        <div className="w-6 border-t-2 border-dashed border-border/60" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Left fade */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-panel to-transparent pointer-events-none" />
            {/* Right fade */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-panel to-transparent pointer-events-none" />
          </div>
        )}
      </div>

      {/* Selected snapshot detail card */}
      {selectedSnapshot && (
        <div className="rounded-xl border-2 border-accent/40 bg-gradient-to-br from-accent/[0.04] to-accent/[0.08] p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-3 h-3 rounded-full bg-accent shadow-sm shadow-accent/30" />
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
                      <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {downloading === selectedSnapshot.objectName ? 'Downloading...' : 'Download'}
                  </button>
                  <button
                    className="bg-accent hover:bg-accent/90 text-white font-semibold py-2 px-5 rounded-lg text-xs shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
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
    </div>
  );
}
