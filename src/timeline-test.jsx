/**
 * Self-contained test page for Timeline integration.
 * Renders ActiveProgressCard + mock day cards to verify:
 * 1. Progress Card renders when agentStatus has totalFiles/scannedFiles/currentFile
 * 2. Progress Card is hidden when idle/no file counts
 * 3. Day cards render with depth stacking effect
 * 4. Download handler creates blob + save dialog
 *
 * Does NOT import SnapshotTimeline — renders components inline to avoid auth/SSE deps.
 */
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

/* ── Helper functions (same as SnapshotTimeline.jsx) ── */
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

/* ── SyncingIcon (same as SnapshotTimeline.jsx) ── */
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

/* ── ActiveProgressCard (exact copy from SnapshotTimeline.jsx) ── */
function ActiveProgressCard({ agentStatus, recentFiles, sseConnected }) {
  const startRef = useRef(null);
  const [eta, setEta] = useState('');
  const [speed, setSpeed] = useState(0);
  const [showLog, setShowLog] = useState(false);

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
    if (done > 3 && elapsed > 1) {
      const rate = done / elapsed;
      const remaining = (totalFiles - scannedFiles) / rate;
      setEta(fmtEta(remaining));
      setSpeed(rate * 1024);
    }
  }, [isActive, scannedFiles, totalFiles]);

  /* Active scan */
  if (isActive && totalFiles > 0) {
    const pct = Math.min(100, Math.round((scannedFiles / totalFiles) * 100));
    const SEGMENTS = 40;
    const filled = Math.round((pct / 100) * SEGMENTS);

    return (
      <div className="rounded-xl border-2 border-dashed border-accent/40 bg-white p-5 relative overflow-hidden"
        style={{ boxShadow: '0 0 24px rgba(15, 108, 189, 0.08)' }}
        data-testid="progress-card">
      <div className="absolute -top-16 -left-16 w-48 h-48 bg-accent/6 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-accent bg-accent/10 px-2.5 py-1 rounded">Active</span>
            <span className="text-sm font-bold text-text1">Snapshot in Progress</span>
          </div>
          <SyncingIcon />
        </div>
        <div className="flex items-center gap-[2px] mb-3">
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <div
              key={i}
              className={`h-5 rounded-sm flex-1 transition-all duration-300 ${
                i < filled ? 'bg-accent tl-segment-pulse' : 'bg-gray-200'
              }`}
              style={{ animationDelay: i < filled ? `${(i % 6) * 100}ms` : undefined }}
            />
          ))}
        </div>
        <div className="flex items-center gap-8 text-xs">
          <div>
            <span className="text-text4">Files Processed: </span>
            <span className="font-bold text-text1 tl-mono" data-testid="file-count">{scannedFiles.toLocaleString()} / {totalFiles.toLocaleString()}</span>
          </div>
          {speed > 0 && (
            <div>
              <span className="text-text4">Speed: </span>
              <span className="font-bold text-text1 tl-mono">{fmtSpeed(speed)}</span>
            </div>
          )}
          {eta && (
            <div>
              <span className="text-text4">Remaining: </span>
              <span className="font-bold text-accent tl-mono">{eta}</span>
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-border/40">
          <button
            className="flex items-center gap-1.5 text-[10px] text-text4 hover:text-accent transition-colors"
            onClick={() => setShowLog(!showLog)}
          >
            <svg className={`w-3 h-3 transition-transform ${showLog ? 'rotate-90' : ''}`} viewBox="0 0 12 12" fill="none">
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Live Terminal
          </button>
          {showLog && (
            <div className="mt-2 bg-gray-900 rounded-lg p-3 text-[11px] leading-relaxed overflow-hidden tl-mono">
              <div className="flex items-center gap-1.5 text-gray-500 mb-1.5">
                <span className="text-green-500">&#x276F;</span> <span className="text-gray-400">backup agent output</span>
              </div>
              {(recentFiles || []).slice(-3).map((f, i) => (
                <div key={i} className="truncate text-gray-300">
                  <span className="text-gray-600 mr-2">.</span>{f}
                </div>
              ))}
              {currentFile && (
                <div className="truncate text-green-400">
                  <span className="text-green-600 mr-2">&#x25B6;</span>{currentFile}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    );
  }

  /* Agent connected but idle */
  if (sseConnected) {
    return (
      <div className="rounded-xl border border-border bg-white px-5 py-3 flex items-center justify-between"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
        data-testid="agent-watching-card">
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 20 20" fill="none">
              <path d="M3.5 10A6.5 6.5 0 0110 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M6 10a4 4 0 014-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="10" cy="10" r="1.5" fill="currentColor" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 tl-live-pulse" />
          </div>
          <span className="text-xs font-medium text-text2">Agent connected</span>
          <span className="text-[10px] text-text4">&mdash; monitoring for file changes</span>
        </div>
        {phase && (
          <span className="text-[10px] text-text4 tl-mono">{phase}</span>
        )}
      </div>
    );
  }

  return null;
}

/* ── Mock snapshot data ── */
const SNAPSHOTS = [
  { objectName: 'snap-2026-05-08-001.enc', flag: 'A', sizeBytes: 52428800, sealedAt: '2026-05-08T09:15:00Z' },
  { objectName: 'snap-2026-05-08-002.enc', flag: 'A', sizeBytes: 31457280, sealedAt: '2026-05-08T14:30:00Z' },
  { objectName: 'snap-2026-05-09-001.enc', flag: 'D', sizeBytes: 10485760, sealedAt: '2026-05-09T08:00:00Z' },
  { objectName: 'snap-2026-05-09-002.enc', flag: 'A', sizeBytes: 67108864, sealedAt: '2026-05-09T16:45:00Z' },
  { objectName: 'snap-2026-05-10-001.enc', flag: 'A', sizeBytes: 41943040, sealedAt: '2026-05-10T10:00:00Z' },
  { objectName: 'snap-2026-05-11-001.enc', flag: 'A', sizeBytes: 89128960, sealedAt: '2026-05-11T06:20:00Z' },
  { objectName: 'snap-2026-05-11-002.enc', flag: 'A', sizeBytes: 125829120, sealedAt: '2026-05-11T11:30:00Z' },
];

/* ── Download handler (exact copy of fixed code from PR #14) ── */
function useDownloadHandler() {
  const [downloading, setDownloading] = useState(null);
  const handleDownload = async (snap) => {
    setDownloading(snap.objectName);
    try {
      // Simulate the downloadObject response
      const testData = new TextEncoder().encode(`TEST_ARCHIVE_DATA_${snap.objectName}`);
      const buf = testData.buffer;
      // This is the NEW code from PR #14:
      const blob = new Blob([buf], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = snap.objectName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log(`[TEST] Download triggered for ${snap.objectName} — blob URL created, anchor clicked`);
    } catch (e) {
      console.error('Download failed:', e);
    } finally {
      setDownloading(null);
    }
  };
  return { downloading, handleDownload };
}

/* ── DayCard (simplified from SnapshotTimeline.jsx) ── */
function DayCard({ dayLabel, snaps, depth, selectedSnap, onSelect }) {
  const mlPx = depth * 12;
  const mrPx = depth * 12;
  const opacity = Math.max(0.4, 1 - depth * 0.15);
  return (
    <div
      className="tl-day-card rounded-xl border border-border/60 bg-white overflow-hidden"
      style={{
        marginLeft: `${mlPx}px`,
        marginRight: `${mrPx}px`,
        opacity,
        boxShadow: `0 ${2 + depth * 2}px ${8 + depth * 4}px rgba(0,0,0,${0.04 + depth * 0.02})`,
      }}
    >
      <div className="px-4 py-2.5 bg-gray-50/80 border-b border-border/40 flex items-center justify-between">
        <span className="text-xs font-bold text-text1">{dayLabel}</span>
        <span className="text-[10px] text-text4">{snaps.length} snapshot{snaps.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="p-3 flex flex-wrap gap-2">
        {snaps.map((snap) => {
          const isSel = selectedSnap?.objectName === snap.objectName;
          const sealDate = snap.sealedAt ? new Date(snap.sealedAt) : null;
          const timeStr = sealDate ? sealDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '??:??';
          const isAdd = snap.flag === 'A';
          return (
            <div
              key={snap.objectName}
              className={`flex flex-col items-center cursor-pointer group shrink-0 rounded-lg px-3 py-2 transition-all ${
                isSel ? 'bg-accent/10 ring-2 ring-accent' : 'hover:bg-gray-50'
              }`}
              onClick={() => onSelect(isSel ? null : snap)}
            >
              <span className="text-[10px] font-medium mb-1">{timeStr}</span>
              <div className={`w-3 h-3 rounded-full ${isAdd ? 'bg-emerald-500' : 'bg-red-400'}`} />
              <span className="text-[9px] mt-1 text-text4">{fmtBytes(snap.sizeBytes || 0)}</span>
              <span className={`text-[8px] font-bold uppercase ${isAdd ? 'text-emerald-500' : 'text-red-400'}`}>
                {isAdd ? 'Backup' : 'Deleted'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Detail Card with Download (glassmorphism) ── */
function DetailCard({ snap, downloading, onDownload }) {
  if (!snap) return null;
  const sealDate = snap.sealedAt ? new Date(snap.sealedAt) : null;
  return (
    <div className="rounded-2xl border-2 border-accent/25 p-5 relative overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
      data-testid="detail-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-3.5 h-3.5 rounded-full bg-accent ring-4 ring-accent/15" />
            <h3 className="text-sm font-bold text-text1">
              {sealDate ? sealDate.toLocaleString() : 'Unknown time'}
            </h3>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              snap.flag === 'A' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
            }`}>
              {snap.flag === 'A' ? 'Active' : 'Deleted'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs ml-7">
            <div>
              <span className="text-text4">Size: </span>
              <span className="font-bold text-text1 tl-mono">{fmtBytes(snap.sizeBytes || 0)}</span>
            </div>
            <div>
              <span className="text-text4">Archive: </span>
              <span className="text-text2 tl-mono text-[10px]">{snap.objectName}</span>
            </div>
          </div>
        </div>
        {snap.flag === 'A' && (
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              className="btn-ghost text-xs py-2 px-4 flex items-center gap-1.5"
              onClick={() => onDownload(snap)}
              disabled={downloading === snap.objectName}
              data-testid="download-btn"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {downloading === snap.objectName ? 'Downloading...' : 'Download'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Test Harness ── */
function TestHarness() {
  const [scenario, setScenario] = useState('scanning');
  const [selectedSnap, setSelectedSnap] = useState(null);
  const { downloading, handleDownload } = useDownloadHandler();

  const scenarios = {
    scanning: {
      label: 'Scanning (1500 total, 450 scanned)',
      agentStatus: {
        phase: 'scanning',
        detail: 'Znaleziono 450 plików w /home/user/Documents',
        totalFiles: 1500,
        scannedFiles: 450,
        currentFile: '/home/user/Documents/Projects/report-2026.pdf',
      },
    },
    uploading: {
      label: 'Uploading (1500 total, 1200 scanned)',
      agentStatus: {
        phase: 'uploading',
        detail: 'Przesyłanie: backup-data.tar.gz',
        totalFiles: 1500,
        scannedFiles: 1200,
        currentFile: '/home/user/Documents/backup-data.tar.gz',
      },
    },
    idle: {
      label: 'Idle + SSE connected (agent watching card)',
      agentStatus: {
        phase: 'idle',
        detail: 'Skan zakończony · następny za 5s',
      },
    },
    idle_disconnected: {
      label: 'Idle + disconnected (no card)',
      agentStatus: {
        phase: 'idle',
        detail: 'Skan zakończony',
      },
      sseConnected: false,
    },
    indexing_no_counts: {
      label: 'Indexing without file counts (agent watching)',
      agentStatus: {
        phase: 'indexing',
        detail: 'Skan dysku: /home/user',
      },
    },
  };

  const current = scenarios[scenario];

  // Group snapshots by day
  const dayGroups = new Map();
  for (const snap of SNAPSHOTS) {
    const d = new Date(snap.sealedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!dayGroups.has(key)) dayGroups.set(key, []);
    dayGroups.get(key).push(snap);
  }
  const dayEntries = [...dayGroups.entries()].reverse();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <h1 className="text-lg font-bold text-text1">Timeline Integration Test</h1>

        {/* Scenario controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-4" data-testid="scenario-controls">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Agent Status Scenario</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(scenarios).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setScenario(key)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  scenario === key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
                data-testid={`scenario-${key}`}
              >
                {val.label}
              </button>
            ))}
          </div>
          <pre className="mt-3 text-[11px] text-gray-500 bg-gray-50 p-2 rounded overflow-x-auto">
            {JSON.stringify(current.agentStatus, null, 2)}
          </pre>
        </div>

        {/* Active Progress Card — the main thing we're testing */}
        <ActiveProgressCard
          agentStatus={current.agentStatus}
          recentFiles={[
            '/home/user/Documents/notes.md',
            '/home/user/Pictures/vacation/IMG_001.jpg',
            '/home/user/Documents/budget.xlsx',
          ]}
          sseConnected={current.sseConnected !== false}
        />

        {/* Summary bar */}
        <div className="flex items-center gap-5 text-xs">
          <span className="text-text3"><span className="font-semibold text-text1">{SNAPSHOTS.length}</span> snapshots</span>
          <span className="text-text3"><span className="font-semibold text-emerald-600">{SNAPSHOTS.filter(s => s.flag === 'A').length}</span> backups</span>
          <span className="text-text3"><span className="font-semibold text-orange-500">{SNAPSHOTS.filter(s => s.flag === 'D').length}</span> deleted</span>
          <span className="text-text3">Total: <span className="font-bold text-text1 tl-mono">{fmtBytes(SNAPSHOTS.reduce((s, x) => s + (x.sizeBytes || 0), 0))}</span></span>
          <span className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200/60 rounded-full px-2.5 py-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 tl-live-pulse" />
            <span className="text-[10px] font-bold tracking-wider">Live</span>
          </span>
        </div>

        {/* Day Cards with depth stacking */}
        <div className="space-y-3">
          {dayEntries.map(([dayKey, snaps], idx) => (
            <DayCard
              key={dayKey}
              dayLabel={dayKey}
              snaps={snaps}
              depth={idx}
              selectedSnap={selectedSnap}
              onSelect={setSelectedSnap}
            />
          ))}
        </div>

        {/* Detail card with download */}
        <DetailCard
          snap={selectedSnap}
          downloading={downloading}
          onDownload={handleDownload}
        />
      </div>

      {/* CSS animations (same as SnapshotTimeline.jsx) */}
      <style>{`
        .tl-mono { font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace; }
        @keyframes tl-segment-pulse-kf { 0%, 100% { opacity: 1; } 50% { opacity: 0.82; } }
        .tl-segment-pulse { animation: tl-segment-pulse-kf 3s ease-in-out infinite; }
        @keyframes tl-spin-kf { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        .tl-spin { animation: tl-spin-kf 2s linear infinite; }
        @keyframes tl-live-kf { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.85); } }
        .tl-live-pulse { animation: tl-live-kf 2s ease-in-out infinite; }
        .tl-day-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .tl-day-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(15, 108, 189, 0.1) !important; }
      `}</style>
    </div>
  );
}

/* ── Mount ── */
createRoot(document.getElementById('root')).render(<TestHarness />);
