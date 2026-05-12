import React, { useState, useEffect, useRef, memo } from 'react';

function fmtSpeed(filesPerSec) {
  if (filesPerSec >= 1000) return `${(filesPerSec / 1000).toFixed(1)}k files/s`;
  return `${Math.round(filesPerSec)} files/s`;
}

function fmtEta(seconds) {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min`;
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
 * Persistent agent status card with smooth Time Machine–style progress bar.
 * Uses CSS transitions for fluid fill animation and client-side interpolation
 * between server updates to avoid jumps.
 */
const STATUS_HOLD_MS = 2000;
const LERP_INTERVAL_MS = 50;

const AgentStatusCard = memo(function AgentStatusCard({ agentStatus, recentFiles, sseConnected }) {
  const startRef = useRef(null);
  const [eta, setEta] = useState('');
  const [speed, setSpeed] = useState(0);
  const [showLog, setShowLog] = useState(false);

  const phase = agentStatus?.phase;
  const totalFiles = agentStatus?.totalFiles || 0;
  const scannedFiles = agentStatus?.scannedFiles || 0;
  const currentFile = agentStatus?.currentFile || '';
  const detail = agentStatus?.detail || '';
  const rawIsActive = phase === 'indexing' || phase === 'scanning' || phase === 'uploading';

  /* Debounce: hold "active" state for at least STATUS_HOLD_MS after it goes away */
  const [displayActive, setDisplayActive] = useState(rawIsActive);
  const activeTimerRef = useRef(null);
  const activeSinceRef = useRef(0);

  useEffect(() => {
    if (rawIsActive) {
      clearTimeout(activeTimerRef.current);
      if (!displayActive) {
        setDisplayActive(true);
        activeSinceRef.current = Date.now();
      }
    } else if (displayActive) {
      const elapsed = Date.now() - activeSinceRef.current;
      const delay = Math.max(0, STATUS_HOLD_MS - elapsed);
      activeTimerRef.current = setTimeout(() => setDisplayActive(false), delay);
    }
    return () => clearTimeout(activeTimerRef.current);
  }, [rawIsActive, displayActive]);

  const isActive = displayActive;

  /* Smooth interpolation: lerp displayed values toward real values */
  const [smoothScanned, setSmoothScanned] = useState(0);
  const [smoothTotal, setSmoothTotal] = useState(0);
  const targetRef = useRef({ scanned: 0, total: 0 });
  const lerpRef = useRef(null);

  useEffect(() => {
    if (rawIsActive && totalFiles > 0) {
      targetRef.current = { scanned: scannedFiles, total: totalFiles };
    } else if (!rawIsActive) {
      targetRef.current = { scanned: 0, total: 0 };
    }
  }, [rawIsActive, scannedFiles, totalFiles]);

  useEffect(() => {
    lerpRef.current = setInterval(() => {
      setSmoothScanned(prev => {
        const target = targetRef.current.scanned;
        if (prev === target) return prev;
        const diff = target - prev;
        const step = Math.max(1, Math.ceil(Math.abs(diff) * 0.15));
        return diff > 0 ? Math.min(prev + step, target) : Math.max(prev - step, target);
      });
      setSmoothTotal(prev => {
        const target = targetRef.current.total;
        if (prev === target) return prev;
        const diff = target - prev;
        const step = Math.max(1, Math.ceil(Math.abs(diff) * 0.15));
        return diff > 0 ? Math.min(prev + step, target) : Math.max(prev - step, target);
      });
    }, LERP_INTERVAL_MS);
    return () => clearInterval(lerpRef.current);
  }, []);

  /* ETA + speed calculation */
  useEffect(() => {
    if (!rawIsActive || totalFiles <= 0) { startRef.current = null; setEta(''); setSpeed(0); return; }
    if (!startRef.current) startRef.current = { time: Date.now(), files: scannedFiles };
    const elapsed = (Date.now() - startRef.current.time) / 1000;
    const done = scannedFiles - startRef.current.files;
    if (done > 10 && elapsed > 1) {
      const rate = done / elapsed;
      const remaining = (totalFiles - scannedFiles) / rate;
      setEta(fmtEta(remaining));
      setSpeed(rate);
    }
  }, [rawIsActive, scannedFiles, totalFiles]);

  /* Compute smooth percentage */
  const pct = isActive && smoothTotal > 0
    ? Math.min(100, (smoothScanned / smoothTotal) * 100)
    : 0;

  /* Phase description */
  let phaseLabel = '';
  if (phase === 'scanning') phaseLabel = 'Discovering files';
  else if (phase === 'indexing') phaseLabel = 'Checking files';
  else if (phase === 'uploading') phaseLabel = 'Uploading changes';

  /* Status label + badge */
  let statusBadge, statusLabel, statusIcon;
  if (isActive) {
    statusBadge = <span className="text-[10px] font-extrabold uppercase tracking-widest text-accent bg-accent/10 px-2.5 py-1 rounded">Active</span>;
    statusLabel = phaseLabel || 'Snapshot in Progress';
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

  /* Bar color */
  const barColor = isActive
    ? 'bg-accent'
    : sseConnected ? 'bg-emerald-400' : 'bg-gray-300';
  const barPct = isActive
    ? pct
    : sseConnected ? 100 : 0;

  const borderClass = isActive
    ? 'border-2 border-dashed border-accent/40'
    : sseConnected
      ? 'border border-emerald-200/60'
      : 'border border-border';

  return (
    <div className={`rounded-xl bg-white p-5 relative overflow-hidden transition-all duration-700 ease-in-out ${borderClass}`}
      style={{ boxShadow: isActive ? '0 0 24px rgba(15, 108, 189, 0.08)' : '0 2px 8px rgba(0,0,0,0.03)' }}>
      <div className={`absolute -top-16 -left-16 w-48 h-48 bg-accent/6 rounded-full blur-3xl pointer-events-none transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0'}`} />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {statusBadge}
            <span className="text-sm font-bold text-text1">{statusLabel}</span>
          </div>
          {statusIcon}
        </div>

        {/* Smooth continuous progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-5 mb-3 overflow-hidden relative">
          <div
            className={`h-full rounded-full ${barColor} ${isActive ? 'asc-bar-glow' : ''}`}
            style={{
              width: `${barPct}%`,
              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              minWidth: isActive && barPct > 0 ? '2%' : undefined,
            }}
          />
          {isActive && smoothTotal > 0 && (
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold asc-mono mix-blend-difference text-white">
              {Math.round(pct)}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-8 text-xs" style={{ minHeight: 20 }}>
          {isActive && smoothTotal > 0 ? (
            <>
              <div>
                <span className="text-text4">Files: </span>
                <span className="font-bold text-text1 asc-mono">{smoothScanned.toLocaleString()} / {smoothTotal.toLocaleString()}</span>
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
          ) : isActive ? (
            <div className="flex items-center gap-2">
              <span className="text-text4">{detail || 'Preparing scan...'}</span>
            </div>
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
@keyframes asc-live-kf {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.85); }
}
.asc-live-pulse { animation: asc-live-kf 2s ease-in-out infinite; }

@keyframes asc-spin-kf { to { transform: rotate(360deg); } }
.asc-spin { animation: asc-spin-kf 2s linear infinite; }

@keyframes asc-bar-glow-kf {
  0%, 100% { box-shadow: 0 0 8px rgba(15, 108, 189, 0.15); }
  50% { box-shadow: 0 0 16px rgba(15, 108, 189, 0.3); }
}
.asc-bar-glow { animation: asc-bar-glow-kf 2s ease-in-out infinite; }

.asc-mono { font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace; }
`;

function AgentStatusStyles() {
  return <style dangerouslySetInnerHTML={{ __html: ASC_STYLES }} />;
}

export { AgentStatusStyles };
export default AgentStatusCard;
