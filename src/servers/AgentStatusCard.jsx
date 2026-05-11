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

/**
 * Persistent agent status card — always visible above Files/Timeline/Activity tabs.
 * Shows three states:
 *   1. Active scan/upload — full progress bar with file counts, speed, ETA, terminal
 *   2. Connected + idle — compact "monitoring" card
 *   3. Disconnected — nothing (returns null)
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

  /* Active scan/upload — full progress card */
  if (isActive && totalFiles > 0) {
    const pct = Math.min(100, Math.round((scannedFiles / totalFiles) * 100));
    const SEGMENTS = 40;
    const filled = Math.round((pct / 100) * SEGMENTS);

    return (
      <div className="rounded-xl border-2 border-dashed border-accent/40 bg-white p-5 relative overflow-hidden"
        style={{ boxShadow: '0 0 24px rgba(15, 108, 189, 0.08)' }}>
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
                  i < filled ? 'bg-accent asc-segment-pulse' : 'bg-gray-200'
                }`}
                style={{ animationDelay: i < filled ? `${(i % 6) * 100}ms` : undefined }}
              />
            ))}
          </div>

          <div className="flex items-center gap-8 text-xs">
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
  }

  /* Connected + idle — compact monitoring card */
  if (sseConnected) {
    return (
      <div className="rounded-xl border border-border bg-white px-5 py-3 flex items-center justify-between"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 20 20" fill="none">
              <path d="M3.5 10A6.5 6.5 0 0110 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M6 10a4 4 0 014-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="10" cy="10" r="1.5" fill="currentColor" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 asc-live-pulse" />
          </div>
          <span className="text-xs font-medium text-text2">Agent connected</span>
          <span className="text-[10px] text-text4">— monitoring for file changes</span>
        </div>
        {phase && (
          <span className="text-[10px] text-text4 asc-mono">{phase}</span>
        )}
      </div>
    );
  }

  /* Disconnected — no card */
  return null;
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
