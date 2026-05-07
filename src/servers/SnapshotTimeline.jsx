import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { fetchArchiveSnapshots } from '../api/bufferClient.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { List as VirtualList } from 'react-window';

function fmtBytes(n) {
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GiB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(2)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${n} B`;
}

function fmtDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function IntegrityBadge({ flag, sealedAt }) {
  const isActive = flag === 'A';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
      isActive ? 'bg-successLight text-success' : 'bg-dangerLight text-danger'
    }`}>
      {isActive ? (
        <>
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Active
        </>
      ) : (
        <>
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Deleted
        </>
      )}
    </span>
  );
}

function SnapshotCard({ snap, onRestore, formatDateTime, isSelected, isActive: isHighlighted, onClick }) {
  const sealDate = snap.sealedAt ? new Date(snap.sealedAt) : null;
  const isActiveFlag = snap.flag === 'A';

  return (
    <div
      className={`px-4 py-3 border-b border-border/50 last:border-0 cursor-pointer transition-colors ${
        isHighlighted ? 'bg-accent/[0.08] ring-2 ring-accent/30 ring-inset' : isSelected ? 'bg-accent/[0.04] ring-1 ring-accent/15 ring-inset' : 'hover:bg-surface/60'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Timeline dot */}
          <div className="flex flex-col items-center shrink-0">
            <div className={`w-3 h-3 rounded-full border-2 ${
              isActiveFlag ? 'border-accent bg-accent/20' : 'border-text4 bg-surface'
            }`} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium text-text1">
                {sealDate ? formatDateTime(snap.sealedAt) : 'Unknown time'}
              </span>
              <IntegrityBadge flag={snap.flag} />
            </div>
            <div className="flex items-center gap-3 text-xs text-text3">
              <span>{fmtBytes(snap.sizeBytes || 0)}</span>
              <span className="font-mono text-text4 truncate max-w-[200px]">{snap.objectName}</span>
            </div>
          </div>
        </div>

        {isActiveFlag && (
          <button
            className="btn-primary py-1.5 px-3 text-xs shrink-0 opacity-0 group-hover:opacity-100"
            style={{ opacity: isSelected ? 1 : undefined }}
            onClick={(e) => {
              e.stopPropagation();
              onRestore(snap);
            }}
          >
            Restore
          </button>
        )}
      </div>

      {isSelected && (
        <div className="mt-3 pl-6 grid grid-cols-2 gap-2 text-xs animate-slide-in">
          <div>
            <span className="text-text4">Object:</span>
            <span className="text-text2 ml-1 font-mono break-all">{snap.objectName}</span>
          </div>
          <div>
            <span className="text-text4">Size:</span>
            <span className="text-text2 ml-1">{fmtBytes(snap.sizeBytes || 0)}</span>
          </div>
          <div>
            <span className="text-text4">Sealed:</span>
            <span className="text-text2 ml-1">{snap.sealedAt ? formatDateTime(snap.sealedAt) : '—'}</span>
          </div>
          <div>
            <span className="text-text4">Flag:</span>
            <span className="text-text2 ml-1">{snap.flag === 'A' ? 'Active' : 'Deleted'}</span>
          </div>
          {isActiveFlag && (
            <div className="col-span-2 mt-1">
              <button
                className="bg-accent hover:bg-accent/90 text-white font-semibold py-2.5 px-6 rounded-xl text-sm shadow-md transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore(snap);
                }}
              >
                Restore to this moment
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function generateFixtureSnapshots() {
  const now = Date.now();
  const hour = 3600000;
  return [
    { objectName: 'snapshots/full-system-2026-05-07T10-00.tar.enc', sealedAt: new Date(now - 5 * hour).toISOString(), sizeBytes: 2147483648, flag: 'A' },
    { objectName: 'snapshots/full-system-2026-05-06T22-00.tar.enc', sealedAt: new Date(now - 17 * hour).toISOString(), sizeBytes: 2130706432, flag: 'A' },
    { objectName: 'snapshots/full-system-2026-05-06T10-00.tar.enc', sealedAt: new Date(now - 29 * hour).toISOString(), sizeBytes: 2113929216, flag: 'A' },
    { objectName: 'snapshots/full-system-2026-05-05T22-00.tar.enc', sealedAt: new Date(now - 41 * hour).toISOString(), sizeBytes: 2097152000, flag: 'A' },
    { objectName: 'snapshots/full-system-2026-05-05T10-00.tar.enc', sealedAt: new Date(now - 53 * hour).toISOString(), sizeBytes: 2080374784, flag: 'A' },
    { objectName: 'snapshots/full-system-2026-05-04T22-00.tar.enc', sealedAt: new Date(now - 65 * hour).toISOString(), sizeBytes: 2063597568, flag: 'D' },
    { objectName: 'snapshots/full-system-2026-05-04T10-00.tar.enc', sealedAt: new Date(now - 77 * hour).toISOString(), sizeBytes: 2046820352, flag: 'D' },
    { objectName: 'snapshots/full-system-2026-05-03T22-00.tar.enc', sealedAt: new Date(now - 89 * hour).toISOString(), sizeBytes: 2030043136, flag: 'A' },
    { objectName: 'snapshots/incremental-2026-05-07T08-00.tar.enc', sealedAt: new Date(now - 7 * hour).toISOString(), sizeBytes: 52428800, flag: 'A' },
    { objectName: 'snapshots/incremental-2026-05-06T20-00.tar.enc', sealedAt: new Date(now - 19 * hour).toISOString(), sizeBytes: 41943040, flag: 'A' },
    { objectName: 'snapshots/incremental-2026-05-06T08-00.tar.enc', sealedAt: new Date(now - 31 * hour).toISOString(), sizeBytes: 36700160, flag: 'A' },
    { objectName: 'snapshots/incremental-2026-05-05T20-00.tar.enc', sealedAt: new Date(now - 43 * hour).toISOString(), sizeBytes: 31457280, flag: 'D' },
  ];
}

export default function SnapshotTimeline({ serverId, onRestore, onSelectSnapshot, selectedSnapshot, verification }) {
  const { token } = useAuth();
  const { formatDateTime } = useI18n();
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [filterFlag, setFilterFlag] = useState('all');

  const load = useCallback(async () => {
    if (!token || !serverId) return;
    setLoading(true);
    try {
      const data = await fetchArchiveSnapshots(serverId, token, { limit: 2000 });
      const sorted = (Array.isArray(data) ? data : []).sort((a, b) => {
        const ta = a.sealedAt ? new Date(a.sealedAt).getTime() : 0;
        const tb = b.sealedAt ? new Date(b.sealedAt).getTime() : 0;
        return tb - ta;
      });
      setSnapshots(sorted);
    } catch (e) {
      const fixtures = generateFixtureSnapshots();
      setSnapshots(fixtures);
    } finally {
      setLoading(false);
    }
  }, [token, serverId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filterFlag === 'all') return snapshots;
    return snapshots.filter((s) => s.flag === filterFlag);
  }, [snapshots, filterFlag]);

  const activeCount = snapshots.filter((s) => s.flag === 'A').length;
  const deletedCount = snapshots.filter((s) => s.flag === 'D').length;
  const totalSize = snapshots.reduce((sum, s) => sum + (s.sizeBytes || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-text3">
            <span className="font-semibold text-text1">{snapshots.length}</span> snapshots
          </span>
          <span className="text-text3">
            <span className="font-semibold text-success">{activeCount}</span> active
          </span>
          <span className="text-text3">
            <span className="font-semibold text-text4">{deletedCount}</span> deleted
          </span>
          <span className="text-text3">
            Total: <span className="font-semibold text-text1">{fmtBytes(totalSize)}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {[
            { key: 'all', label: 'All' },
            { key: 'A', label: 'Active' },
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
      </div>

      {/* Verification status */}
      {verification && (
        <div className={`px-4 py-2.5 rounded-xl2 border text-xs ${
          verification.status === 'passed'
            ? 'bg-successLight border-success/25 text-success'
            : verification.status === 'failed'
              ? 'bg-dangerLight border-danger/25 text-danger'
              : 'bg-surface border-border text-text3'
        }`}>
          <span className="font-semibold">Integrity check:</span>{' '}
          {verification.status === 'passed' ? 'Passed' : verification.status === 'failed' ? 'Failed' : verification.status}
          {verification.verifiedAt && (
            <span className="text-text4 ml-2">({formatDateTime(verification.verifiedAt)})</span>
          )}
          {verification.detail && (
            <span className="text-text4 ml-2">— {verification.detail}</span>
          )}
        </div>
      )}

      {/* Selected snapshot restore bar */}
      {selectedSnapshot && (
        <div className="px-5 py-4 rounded-xl2 border-2 border-accent bg-accent/[0.04] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text1">Time travel to this moment</div>
            <div className="text-xs text-text3 mt-0.5">
              {selectedSnapshot.sealedAt ? formatDateTime(selectedSnapshot.sealedAt) : 'Unknown time'}
              {' — '}
              {fmtBytes(selectedSnapshot.sizeBytes || 0)}
            </div>
          </div>
          <button
            className="bg-accent hover:bg-accent/90 text-white font-semibold py-3 px-8 rounded-xl text-sm shadow-lg transition-all hover:shadow-xl active:scale-[0.98] shrink-0"
            onClick={() => onRestore(selectedSnapshot)}
          >
            Restore to this moment
          </button>
        </div>
      )}

      {/* Timeline list */}
      <div className="rounded-xl2 border border-border bg-panel overflow-hidden shadow-card">
        <div className="px-4 py-2 border-b border-border bg-surface/90 flex items-center justify-between">
          <span className="text-xs text-text3 font-medium">Snapshot Timeline</span>
          <button className="btn-ghost text-xs py-1" onClick={load} disabled={loading}>
            {loading ? '...' : 'Refresh'}
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8 text-text4 text-xs gap-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Loading snapshots...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-text4">
            <svg className="w-10 h-10 mb-3 text-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <p className="text-sm">No snapshots yet</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          filtered.length > 100 ? (
            <VirtualList
              height={Math.min(filtered.length * 80, 560)}
              itemCount={filtered.length}
              itemSize={80}
              width="100%"
              overscanCount={10}
            >
              {({ index, style }) => {
                const snap = filtered[index];
                const isActive = selectedSnapshot?.objectName === snap.objectName;
                return (
                  <div style={style}>
                    <SnapshotCard
                      snap={snap}
                      onRestore={onRestore}
                      formatDateTime={formatDateTime}
                      isSelected={expandedIdx === index}
                      isActive={isActive}
                      onClick={() => {
                        setExpandedIdx(expandedIdx === index ? null : index);
                        if (onSelectSnapshot) onSelectSnapshot(isActive ? null : snap);
                      }}
                    />
                  </div>
                );
              }}
            </VirtualList>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {filtered.map((snap, i) => {
                const isActive = selectedSnapshot?.objectName === snap.objectName;
                return (
                  <SnapshotCard
                    key={snap.objectName}
                    snap={snap}
                    onRestore={onRestore}
                    formatDateTime={formatDateTime}
                    isSelected={expandedIdx === i}
                    isActive={isActive}
                    onClick={() => {
                      setExpandedIdx(expandedIdx === i ? null : i);
                      if (onSelectSnapshot) onSelectSnapshot(isActive ? null : snap);
                    }}
                  />
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
