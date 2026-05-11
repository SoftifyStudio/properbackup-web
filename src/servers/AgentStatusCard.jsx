import React, { useState, useEffect, useRef, memo } from 'react';

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

function SyncingIcon() {
  return (
    <svg className="w-5 h-5 text-accent asc-spin" viewBox="0 0 20 20" fill="none">
      <path d="M14.5 3.5A7 7 0 003 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M5.5 16.5A7 7 0 0017 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14.5 3.5L14.5 7L11 3.5" fill="currentColor" opacity="0.8"/>
      <path d="M5.5 16.5L5.5 13L9 16.5" fill="currentColor" opacity="0.8"/>
    </svg>
  );
}

const SEGMENTS = 40;

/**
 * Persistent agent status card — ALWAYS shows the same-height card with progress bar.
 * The bar fills during active scans and stays full/empty in other states.
 * Never changes height, never disappears.
 */
const AgentStatusCard = memo(function AgentStatusCard({ agentStatus, recentFiles, sseConnected }) {
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
    if (!isActive || totalFiles <= 0) { startRef.current = null; setEta(''); setSpeed(0); return; }
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

  /* Compute progress bar fill */
  let filled = 0;
  let pct = 0;
  if (isActive && totalFiles > 0) {
    pct = Math.min(100, Math.round((scannedFiles / totalFiles) * 100));
    filled = Math.round((pct / 100) * SEGMENTS);
  } else if (isActive) {
    filled = 0;
  }

  /* Status label + badge */
  let statusBadge, statusLabel, statusIcon;
  if (isActive) {
    statusBadge = <span className="text-[10px] font-extrabold uppercase tracking-widest text-accent bg-accent/10 px-2.5 py-1 rounded">Active</span>;
    statusLabel = 'Snapshot in Progress';
    statusIcon = <SyncingIcon />;
  } else if (sseConnected) {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200/60 rounded-full px-2.5 py-1">
        <span className="w-2 h-2 rounded-full bg-emerald-500 asc-live-pulse" />
        <span className="text-[10px] font-bold tracking-wider">Live</span>
      </span>
    );
    statusLabel = 'Monitoring for file changes';
    statusIcon = (
      <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 20 20" fill="none">
        <path d="M3.5 10A6.5 6.5 0 0110 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6 10a4 4 0 014-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      </svg>
    );
  } else {
    statusBadge = <span className="text-[10px] font-extrabold uppercase tracking-widest text-text4 bg-gray-100 px-2.5 py-1 rounded">Offline</span>;
    statusLabel = 'Agent disconnected';
    statusIcon = (
      <svg className="w-5 h-5 text-text4" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }

  /* Segment color */
  const segFilled = isActive ? 'bg-accent asc-segment-pulse' : sseConnected ? 'bg-emerald-400' : 'bg-gray-300';
  const segEmpty = 'bg-gray-200';
  const displayFilled = isActive ? filled : sseConnected ? SEGMENTS : 0;

  const borderClass = isActive
    ? 'border-2 border-dashed border-accent/40'
    : sseConnected
      ? 'border border-emerald-200/60'
      : 'border border-border';

  return (
    <div className={`rounded-xl bg-white p-5 relative overflow-hidden ${borderClass}`}
      style={{ boxShadow: isActive ? '0 0 24px rgba(15, 108, 189, 0.08)' : '0 2px 8px rgba(0,0,0,0.03)' }}>
      {isActive && <div className="absolute -top-16 -left-16 w-48 h-48 bg-accent/6 rounded-full blur-3xl pointer-events-none" />}

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {statusBadge}
            <span className="text-sm font-bold text-text1">{statusLabel}</span>
          </div>
          {statusIcon}
        </div>

        <div className="flex items-center gap-[2px] mb-3">
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <div
              key={i}
              className={`h-5 rounded-sm flex-1 transition-all duration-300 ${
                i < displayFilled ? segFilled : segEmpty
              }`}
              style={{ animationDelay: isActive && i < displayFilled ? `${(i % 6) * 100}ms` : undefined }}
            />
          ))}
        </div>

        <div className="flex items-center gap-8 text-xs" style={{ minHeight: 20 }}>
          {isActive && totalFiles > 0 ? (
            <>
              <div>
                <span className="text-text4">Files Processed: </span>
                <span className="font-bold text-text1 asc-mono">{scannedFiles.toLocaleString()} / {totalFiles.toLocaleString()}</span>
              </div>
              {speed > 0 && (
                <div>
                  <span className="text-text4">Speed: </span>
                  <span className="font-bold text-text1 asc-mono">{fmtSpeed(speed)}</span>
                </div>
              )}
              {eta && (
                <div>
                  <span className="text-text4">Remaining: </span>
                  <span className="font-bold text-accent asc-mono">{eta}</span>
                </div>
              )}
            </>
          ) : sseConnected ? (
            <div className="flex items-center gap-2">
              <span className="text-text4">Agent connected</span>
              {phase && <span className="text-text4 asc-mono">· {phase}</span>}
            </div>
          ) : (
            <span className="text-text4">Waiting for agent connection...</span>
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
            <div className="mt-2 bg-gray-900 rounded-lg p-3 text-[11px] leading-relaxed overflow-hidden asc-mono">
              <div className="flex items-center gap-1.5 text-gray-500 mb-1.5">
                <span className="text-green-500">&#x276F;</span> <span className="text-gray-400">backup agent output</span>
              </div>
              {(recentFiles || []).length === 0 && !currentFile && (
                <div className="text-gray-500 italic">No recent activity</div>
              )}
              {(recentFiles || []).slice(-3).map((f, i) => (
                <div key={i} className="truncate text-gray-300">
                  <span className="text-gray-600 mr-2">.</span>{f}
                </div>
              ))}
              {currentFile && (
                <div className="truncate text-green-400 mt-0.5">
                  <span className="text-green-600 mr-2">&#x25B8;</span>{currentFile}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

/* Scoped CSS for AgentStatusCard animations */
const ASC_STYLES = `
@keyframes asc-segment-pulse-kf {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.82; }
}
.asc-segment-pulse { animation: asc-segment-pulse-kf 3s ease-in-out infinite; }

@keyframes asc-live-kf {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.85); }
}
.asc-live-pulse { animation: asc-live-kf 2s ease-in-out infinite; }

@keyframes asc-spin-kf { to { transform: rotate(360deg); } }
.asc-spin { animation: asc-spin-kf 2s linear infinite; }

.asc-mono { font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace; }
`;

function AgentStatusStyles() {
  return <style dangerouslySetInnerHTML={{ __html: ASC_STYLES }} />;
}

export { AgentStatusStyles };
export default AgentStatusCard;
