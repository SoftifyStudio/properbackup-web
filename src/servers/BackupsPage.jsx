import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import AppHeader from '../layout/AppHeader.jsx';
import AdminModeBar from '../layout/AdminModeBar.jsx';
import { buildTree } from '../tree/TreeBuilder.js';
import DirectoryView from '../tree/DirectoryView.jsx';
import RecoveryWizard from '../recovery/RecoveryWizard.jsx';
import InventoryPanel from './InventoryPanel.jsx';
import AgentIndexBanner from './AgentIndexBanner.jsx';
import DocumentationTab from './DocumentationTab.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import FolderConfigPanel from './FolderConfigPanel.jsx';
import ActivityLog from './ActivityLog.jsx';
import SnapshotTimeline from './SnapshotTimeline.jsx';
import AgentStatusCard, { AgentStatusStyles } from './AgentStatusCard.jsx';
import MonitoringTab from './MonitoringTab.jsx';
import FolderTreeView from './FolderTreeView.jsx';
import useServerEvents from '../api/useServerEvents.js';
import { fetchInventory, fetchInventoryMeta, fetchInventorySummary, forceFlush, fetchFileStatesAt, downloadObject, fetchActivity } from '../api/bufferClient.js';
import { useSearchParams } from 'react-router-dom';

// Fixture imports kept only for legacy StatusBar (tree view) — not used for file list
import fixtureListing from '../fixtures/mock-bucket-listing.json';
import fixtureIdxData from '../fixtures/mock-paths-idx.json';

import { bufferBaseUrl } from '../bufferConfig.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const BASE_URL = bufferBaseUrl();

function StatusBar({ nodeCount, snapshotCount, orphanCount, updatedAt }) {
  const { t, formatDateTime } = useI18n();
  return (
    <div className="shrink-0 flex items-center gap-6 px-6 py-2 border-b border-border bg-sidebar text-xs text-text3">
      <div className="flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
          <path d="M1 4.5a1.5 1.5 0 011.5-1.5h3L6.5 4h5a1.5 1.5 0 011.5 1.5v5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 011 10.5v-6z" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
        <span>{t('backups.paths', { count: nodeCount })}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M7 4.5v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span>{t('backups.snapshots', { count: snapshotCount })}</span>
      </div>
      {orphanCount > 0 && (
        <div className="flex items-center gap-1.5 text-warn">
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5L13 12H1L7 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            <path d="M7 5.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="7" cy="10" r="0.7" fill="currentColor"/>
          </svg>
          <span>{t('backups.orphans', { count: orphanCount })}</span>
        </div>
      )}
      <span className="ml-auto text-text4">
        {t('backups.idx')} {formatDateTime(updatedAt)}
      </span>
    </div>
  );
}

/* ── More Menu (Monitoring / Settings / Logs) ── */
function MoreMenu({ serviceTab, setServiceTab, isSystemAdmin }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isSecondary = ['monitoring', 'settings', 'logs'].includes(serviceTab);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const items = [
    { key: 'monitoring', label: 'Monitoring', icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M3.5 8l2-2.5 2 1.5L10 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    ) },
    { key: 'settings', label: 'Settings', icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1.1 1.1M10.1 10.1l1.1 1.1M11.2 2.8l-1.1 1.1M3.9 10.1l-1.1 1.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
    ) },
  ];

  if (isSystemAdmin) {
    items.push({ key: 'logs', label: 'Logs', icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
    ) });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className={`btn-ghost text-xs py-1.5 px-2.5 flex items-center gap-1.5 ${isSecondary ? 'ring-1 ring-accent/40 font-semibold' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="3" r="1.2" fill="currentColor"/>
          <circle cx="8" cy="8" r="1.2" fill="currentColor"/>
          <circle cx="8" cy="13" r="1.2" fill="currentColor"/>
        </svg>
        {isSecondary && <span className="capitalize">{serviceTab}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg py-1 min-w-[160px] z-50">
          {items.map(({ key, label, icon }) => (
            <button
              key={key}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-surface transition-colors ${
                serviceTab === key ? 'text-accent font-semibold bg-accent/5' : 'text-text2'
              }`}
              onClick={() => { setServiceTab(key); setOpen(false); }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BackupsPage({ server, onBack }) {
  const { token, isSystemAdmin } = useAuth();
  const { t, formatDateTime } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode]               = useState('fixture');
  const [objectNames, setObjectNames] = useState(fixtureListing);
  const [pathsIdx, setPathsIdx]       = useState(fixtureIdxData.paths);
  const [updatedAt, setUpdatedAt]     = useState(fixtureIdxData.updated);
  const [recoveryTarget, setRecoveryTarget] = useState(null);
  const [refreshing, setRefreshing]         = useState(false);
  const [error, setError]                   = useState(null);
  const [logs, setLogs]                     = useState([]);
  const [fileStates, setFileStates]         = useState([]);
  const [fileSortMode, setFileSortMode]     = useState('recent');
  const [statusFilter, setStatusFilter]     = useState('all');
  const [activityLog, setActivityLog]       = useState([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [newPaths, setNewPaths]             = useState(new Set());
  const activityIdRef = useRef(0);
  const [snapshotFiles, setSnapshotFiles]   = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError]     = useState(false);
  const [liveIndexMeta, setLiveIndexMeta]   = useState({
    agentStatus: null,
    rootsCount: 0,
    totalFiles: 0,
    latestVerification: null,
    loading: false,
  });
  const [logsSince, setLogsSince]           = useState(null);
  const [logLevel, setLogLevel]             = useState('');
  const [logComponent, setLogComponent]     = useState('');
  const [showDebug, setShowDebug]           = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [latestSnapshot, setLatestSnapshot] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);
  const urlTab = searchParams.get('tab');
  const isAllowedTab = ['files', 'timeline', 'activity', 'monitoring', 'settings', 'logs'].includes(urlTab || '');
  const serviceTab = isAllowedTab ? urlTab : 'files';

  const setServiceTab = useCallback((nextTab) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('tab', nextTab);
      if (!p.get('name') && server?.name) p.set('name', server.name);
      return p;
    }, { replace: true });
  }, [setSearchParams, server?.name]);

  const fetchServerData = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    setError(null);
    try {
      const authHeaders = { Authorization: `Bearer ${token}` };
      const idxUrl = `${BASE_URL}/servers/${server.id}/paths.idx`;
      const objUrl = `${BASE_URL}/servers/${server.id}/objects`;
      const [idxRes, objRes] = await Promise.all([
        fetch(idxUrl, { headers: authHeaders }),
        fetch(objUrl, { headers: authHeaders }),
      ]);

      if (!objRes.ok) {
        throw new Error(`objects ${objRes.status}, paths.idx ${idxRes.status}`);
      }
      const objects = await objRes.json();

      let paths = {};
      let updated = new Date().toISOString();
      if (idxRes.ok) {
        const idxData = await idxRes.json();
        paths = idxData.paths ?? {};
        updated = idxData.updated ?? updated;
      }

      setPathsIdx(paths);
      setUpdatedAt(updated);
      setObjectNames(objects ?? []);
      setMode('live');
    } catch {
      setMode('fixture');
    } finally {
      setRefreshing(false);
    }
  }, [token, server?.id, t]);

  useEffect(() => { fetchServerData(); }, [fetchServerData]);

  /** Logi stacku — wyłącznie endpoint admin (JWT z uprawnieniami serwisanta). */
  const fetchAdminLogs = useCallback(async () => {
    if (!token || !isSystemAdmin) return;
    try {
      const authHeaders = { Authorization: `Bearer ${token}` };
      const logsUrl = new URL(`${BASE_URL}/admin/logs`, window.location.origin);
      logsUrl.searchParams.set('machineId', server.id);
      logsUrl.searchParams.set('limit', '300');
      if (logsSince) logsUrl.searchParams.set('since', logsSince);
      if (logLevel) logsUrl.searchParams.set('level', logLevel);
      if (logComponent) logsUrl.searchParams.set('component', logComponent);

      const logsRes = await fetch(logsUrl, { headers: authHeaders });
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        if (logsData.length > 0) {
          setLogs(prev => [...logsData.reverse(), ...prev].slice(0, 1000));
          setLogsSince(logsData[0].createdAt);
        }
      }
    } catch {
      /* ignore */
    }
  }, [token, isSystemAdmin, server.id, logsSince, logLevel, logComponent]);

  /** Fallback polling for meta (only used when SSE is not connected). */
  const fetchLiveMeta = useCallback(async () => {
    if (!token) return;
    try {
      const inv = await fetchInventorySummary(server.id, token);
      setLiveIndexMeta((m) => {
        const newVerif = inv.latestVerification ?? null;
        const prevVerif = m.latestVerification;
        const verifChanged = !prevVerif !== !newVerif
          || (newVerif && prevVerif && (newVerif.status !== prevVerif.status || newVerif.verifiedAt !== prevVerif.verifiedAt));
        return {
          ...m,
          agentStatus: inv.agentStatus ?? null,
          rootsCount: inv.rootsCount ?? 0,
          totalFiles: inv.totalFiles ?? 0,
          latestVerification: verifChanged ? newVerif : prevVerif,
        };
      });
    } catch {
      /* keep previous state */
    }
  }, [token, server.id]);

  /** SSE event handlers — real-time updates from buffer */
  const addActivityEntry = useCallback((entry) => {
    setActivityLog((prev) => {
      if (entry.type === 'agentStatus') {
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].type === 'agentStatus') {
            if (prev[i].phase === entry.phase) {
              const next = [...prev];
              next[i] = { ...entry, id: prev[i].id };
              return next;
            }
            break;
          }
        }
      }
      const next = [...prev, { ...entry, id: ++activityIdRef.current }];
      return next.length > 500 ? next.slice(-400) : next;
    });
  }, []);

  const sseHandlers = useMemo(() => ({
    onAgentStatus: (data) => {
      setLiveIndexMeta((m) => ({
        ...m,
        agentStatus: {
          ...m.agentStatus,
          phase: data.phase,
          detail: data.detail,
          totalFiles: data.totalFiles,
          scannedFiles: data.scannedFiles,
          currentFile: data.currentFile,
          updatedAt: data.updatedAt,
        },
      }));
      if (data.currentFile) {
        setRecentFiles(prev => [...prev, data.currentFile].slice(-10));
      }
      addActivityEntry({ type: 'agentStatus', ...data });
    },
    onFileState: (data) => {
      setFileStates((prev) => {
        const idx = prev.findIndex((f) => f.fullPath === data.fullPath);
        const updated = { fullPath: data.fullPath, status: data.status, updatedAt: data.ts };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [updated, ...prev];
      });
      setNewPaths((s) => { const n = new Set(s); n.add(data.fullPath); return n; });
      setTimeout(() => setNewPaths((s) => { const n = new Set(s); n.delete(data.fullPath); return n; }), 1200);
      addActivityEntry({ type: 'fileState', ...data });
    },
    onFileStateBatch: (data) => {
      addActivityEntry({ type: 'fileStateBatch', ...data });
    },
    onLog: (data) => {
      addActivityEntry({ type: 'log', ...data });
    },
    onSnapshotCreated: (data) => {
      setLatestSnapshot(data);
      addActivityEntry({ type: 'snapshotCreated', objectName: data.objectName, sizeBytes: data.sizeBytes });
    },
  }), [addActivityEntry]);

  const { connected: sseConnected, reconnecting: sseReconnecting } = useServerEvents(server.id, sseHandlers, token);

  /** Lista plików z bufferu: GET /servers/{id}/inventory (JWT). */
  const fetchLiveFileStates = useCallback(async (withLoadingSpinner = false) => {
    if (!token) return;
    if (withLoadingSpinner) {
      setLiveIndexMeta((m) => ({ ...m, loading: true }));
    }
    try {
      const rows = [];
      let page = 1;
      let hasMore = true;
      let firstInv = null;
      const maxPages = 50;
      while (hasMore && page <= maxPages) {
        const inv = await fetchInventory(server.id, token, page, 1000, fileSortMode);
        if (page === 1) firstInv = inv;
        rows.push(...(inv.files ?? []));
        hasMore = !!inv.hasMore;
        page += 1;
      }
      if (fileSortMode === 'path') {
        rows.sort((a, b) => a.fullPath.localeCompare(b.fullPath));
      }
      setFileStates(rows);
      setLiveIndexMeta({
        agentStatus: firstInv?.agentStatus ?? null,
        rootsCount: firstInv?.roots?.length ?? 0,
        totalFiles: firstInv?.totalFiles ?? 0,
        loading: false,
      });
    } catch {
      setLiveIndexMeta((m) => ({ ...m, loading: false }));
    }
  }, [token, server.id, fileSortMode]);

  useEffect(() => {
    if (!isSystemAdmin) return;
    fetchAdminLogs();
    const id = setInterval(fetchAdminLogs, 3000);
    return () => clearInterval(id);
  }, [isSystemAdmin, fetchAdminLogs]);

  useEffect(() => {
    if (!isAllowedTab) {
      setServiceTab('backups');
      return;
    }
    if (serviceTab === 'logs' && !isSystemAdmin) {
      setServiceTab('backups');
    }
  }, [isAllowedTab, serviceTab, isSystemAdmin, setServiceTab]);

  const isIndexing = liveIndexMeta.agentStatus?.phase === 'indexing';

  /** Load activity history from DB on mount (survives page refresh). */
  useEffect(() => {
    if (!token || activityLoaded) return;
    (async () => {
      try {
        const data = await fetchActivity(server.id, token);
        const entries = [];
        // Convert recent logs to activity entries
        if (data.recentLogs) {
          for (const log of data.recentLogs) {
            entries.push({
              type: 'log',
              component: log.component,
              eventCode: log.eventCode,
              level: log.level,
              message: log.message,
              meta: log.meta,
              ts: log.createdAt,
              id: ++activityIdRef.current,
            });
          }
        }
        // Convert recent file events to activity entries
        if (data.recentFileEvents) {
          for (const ev of data.recentFileEvents) {
            entries.push({
              type: 'fileState',
              fullPath: ev.fullPath,
              status: ev.status,
              previousStatus: ev.previousStatus,
              ts: ev.occurredAt,
              id: ++activityIdRef.current,
            });
          }
        }
        // Sort all entries by timestamp (oldest first)
        entries.sort((a, b) => new Date(a.ts) - new Date(b.ts));
        if (entries.length > 0) {
          setActivityLog(entries);
        }
        // Set agent status from history
        if (data.agentStatus) {
          setLiveIndexMeta((m) => ({
            ...m,
            agentStatus: data.agentStatus,
          }));
          // Add agent status as first activity entry
          addActivityEntry({ type: 'agentStatus', ...data.agentStatus });
        }
      } catch {
        /* ignore — SSE will populate on connect */
      } finally {
        setActivityLoaded(true);
      }
    })();
  }, [token, server.id, activityLoaded, addActivityEntry]);

  /** Initial file load + fallback poll (only when SSE is disconnected). */
  useEffect(() => {
    fetchLiveFileStates(true);
    fetchLiveMeta();
  }, [fetchLiveFileStates, fetchLiveMeta]);

  useEffect(() => {
    if (sseConnected) return;
    const metaId = setInterval(fetchLiveMeta, 2000);
    const filesId = setInterval(() => fetchLiveFileStates(false), isIndexing ? 3000 : 8000);
    return () => {
      clearInterval(metaId);
      clearInterval(filesId);
    };
  }, [sseConnected, fetchLiveFileStates, fetchLiveMeta, isIndexing]);

  /** Periodic full-list refresh even with SSE (batch updates don't carry all data). */
  useEffect(() => {
    if (!sseConnected) return;
    const id = setInterval(() => fetchLiveFileStates(false), 15000);
    return () => clearInterval(id);
  }, [sseConnected, fetchLiveFileStates]);

  /** Fetch historical file states when a snapshot is selected */
  const fetchSnapshotFiles = useCallback(async (snap) => {
    if (!token || !snap?.sealedAt) return;
    setSnapshotLoading(true);
    setSnapshotError(false);
    try {
      const rows = [];
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= 50) {
        const inv = await fetchFileStatesAt(server.id, token, snap.sealedAt, page, 1000, fileSortMode);
        rows.push(...(inv.files ?? []));
        hasMore = !!inv.hasMore;
        page += 1;
      }
      setSnapshotFiles(rows);
    } catch {
      setSnapshotFiles(null);
      setSnapshotError(true);
    } finally {
      setSnapshotLoading(false);
    }
  }, [token, server.id, fileSortMode]);

  useEffect(() => {
    if (selectedSnapshot) {
      fetchSnapshotFiles(selectedSnapshot);
    } else {
      setSnapshotFiles(null);
      setSnapshotError(false);
    }
  }, [selectedSnapshot, fetchSnapshotFiles]);

  const displayFiles = selectedSnapshot && snapshotFiles ? snapshotFiles : fileStates;

  const filteredFiles = useMemo(() => {
    if (statusFilter === 'all') return displayFiles;
    return displayFiles.filter((f) => f.status === statusFilter);
  }, [displayFiles, statusFilter]);

  const nodes = useMemo(() => buildTree(objectNames, pathsIdx), [objectNames, pathsIdx]);
  const snapshotCount = nodes.reduce((s, n) => s + n.snapshots.length, 0);
  const orphanCount   = nodes.filter(n => n.isOrphan).length;

  const handleFlush = async () => {
    if (!token) return;
    try {
      await forceFlush(token);
      await fetchServerData();
    } catch (e) {
      setError(t('backups.flushError', { message: e.message }));
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface overflow-hidden">
      <AgentStatusStyles />
      <AppHeader onBack={onBack} backLabel={t('backups.backLabel')}>
        <span className="badge bg-accentLight text-accent text-xs">{server.name}</span>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ml-2 ${
          sseConnected ? 'text-success' : sseReconnecting ? 'text-amber-500' : 'text-text4'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            sseConnected ? 'bg-success animate-pulse' : sseReconnecting ? 'bg-amber-500 animate-pulse' : 'bg-text4'
          }`} />
          {sseConnected ? 'Connected' : sseReconnecting ? 'Reconnecting...' : 'Disconnected'}
        </span>
      </AppHeader>
      {isSystemAdmin && <AdminModeBar variant="server" server={server} />}

      {/* Unified bar: tabs + verification + health score + more menu */}
      <div className="shrink-0 px-6 py-2 border-b border-border bg-panel flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg px-1 py-0.5 bg-accent/5">
          <button className={`btn-ghost text-xs py-1.5 ${serviceTab === 'files' ? 'ring-1 ring-accent/40 font-semibold' : ''}`} onClick={() => setServiceTab('files')}>
            Files
          </button>
          <button className={`btn-ghost text-xs py-1.5 ${serviceTab === 'timeline' ? 'ring-1 ring-accent/40 font-semibold' : ''}`} onClick={() => setServiceTab('timeline')}>
            Timeline
          </button>
          <button className={`btn-ghost text-xs py-1.5 ${serviceTab === 'activity' ? 'ring-1 ring-accent/40 font-semibold' : ''}`} onClick={() => setServiceTab('activity')}>
            Activity
          </button>
        </div>
        <div className="flex-1" />
        {(() => {
          const v = liveIndexMeta.latestVerification;
          const hasFiles = liveIndexMeta.totalFiles > 0 || fileStates.length > 0;
          const verifiedAgo = v?.verifiedAt ? Math.round((Date.now() - new Date(v.verifiedAt).getTime()) / 3600000) : null;
          return (
            <span className="text-[11px] text-text4">
              {verifiedAgo !== null && `Verified ${verifiedAgo < 1 ? 'just now' : `${verifiedAgo}h ago`}`}
              {!hasFiles && 'No files indexed yet'}
              {hasFiles && !v && 'Awaiting first verification'}
              {liveIndexMeta.totalFiles > 0 && ` · ${liveIndexMeta.totalFiles.toLocaleString()} files protected`}
            </span>
          );
        })()}
        {(() => {
          const v = liveIndexMeta.latestVerification;
          const hasFiles = liveIndexMeta.totalFiles > 0 || fileStates.length > 0;
          const isVerified = v?.status === 'passed';
          const isFailed = v?.status === 'failed';
          const score = !hasFiles ? 0 : isFailed ? 40 : isVerified ? 100 : 80;
          const color = score >= 90 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
          const bgColor = score >= 90 ? 'bg-emerald-50 border-emerald-200' : score >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
          const dotColor = score >= 90 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
          return (
            <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-xs ${bgColor}`}>
              <span className={`w-2 h-2 rounded-full ${dotColor} ${score >= 90 ? 'animate-pulse' : ''}`} />
              <span className={`font-semibold ${color}`}>{score}% Safe</span>
            </div>
          );
        })()}
        <MoreMenu serviceTab={serviceTab} setServiceTab={setServiceTab} isSystemAdmin={isSystemAdmin} />
      </div>

      {/* Agent status card — below tabs bar */}
      <div className="shrink-0 px-6 pt-4 pb-3 w-full mx-auto max-w-6xl">
        <AgentStatusCard
          agentStatus={liveIndexMeta.agentStatus}
          recentFiles={recentFiles}
          sseConnected={sseConnected}
        />
      </div>


      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-6 w-full mx-auto max-w-6xl">
        {serviceTab === 'files' && (
          <ErrorBoundary title="Files" retryLabel="Refresh">
            <div className="space-y-4">
              {/* Time-travel bar when viewing a snapshot */}
              {selectedSnapshot && (
                <div className="flex items-center justify-between gap-4 px-5 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <svg className="w-5 h-5 text-amber-600 shrink-0" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-amber-800">Viewing snapshot</span>
                      <span className="text-sm text-amber-700 ml-2">
                        {selectedSnapshot.sealedAt ? formatDateTime(selectedSnapshot.sealedAt) : 'Unknown time'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      className="bg-accent hover:bg-accent/90 text-white font-semibold py-2 px-5 rounded-lg text-sm shadow transition-all active:scale-[0.98]"
                      onClick={() => setRecoveryTarget({ snap: selectedSnapshot, node: null })}
                    >
                      Restore to this moment
                    </button>
                    <button
                      className="bg-white hover:bg-gray-50 text-[#323130] font-medium py-2 px-4 rounded-lg text-sm border border-[#edebe9] shadow-sm transition-all"
                      onClick={() => setSelectedSnapshot(null)}
                    >
                      Back to Live
                    </button>
                  </div>
                </div>
              )}

              {/* Status filter toolbar */}
              <div className="flex items-center justify-between px-1 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  {['all', 'current', 'changed', 'new', 'deleted'].map((s) => (
                    <button
                      key={s}
                      className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                        statusFilter === s ? 'bg-accent/15 text-accent font-semibold' : 'text-text3 hover:text-text2 hover:bg-surface/80'
                      }`}
                      onClick={() => setStatusFilter(s)}
                    >
                      {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                      {s !== 'all' && (
                        <span className="ml-1 text-text4">
                          ({displayFiles.filter((f) => f.status === s).length})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-text4">
                  {selectedSnapshot
                    ? (snapshotLoading ? 'Loading snapshot...' : `${displayFiles.length} files at this moment`)
                    : `${fileStates.length} files indexed`}
                </span>
              </div>

              {/* Snapshot fetch error */}
              {selectedSnapshot && snapshotError && !snapshotLoading && (
                <div className="flex items-center gap-3 px-5 py-3 bg-red-50 border border-red-200 rounded-lg">
                  <svg className="w-5 h-5 text-red-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-red-700">
                    <span className="font-semibold">Cannot load snapshot data.</span>
                    <span className="ml-1">Buffer service may be unavailable. Showing live files instead.</span>
                  </div>
                </div>
              )}

              {/* Empty state when no files indexed */}
              {!selectedSnapshot && fileStates.length === 0 && !liveIndexMeta.loading && (
                <div className="flex flex-col items-center justify-center py-16 text-text4">
                  <svg className="w-12 h-12 mb-3 text-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <p className="text-sm font-medium text-text3">Waiting for agent to index files...</p>
                  <p className="text-xs text-text4 mt-1">Files will appear here as the agent scans your system</p>
                </div>
              )}

              {/* OneDrive-style folder tree view */}
              {(fileStates.length > 0 || selectedSnapshot) && (
                <FolderTreeView
                  files={filteredFiles}
                  newPaths={newPaths}
                  formatDateTime={formatDateTime}
                  snapshotLabel={selectedSnapshot ? formatDateTime(selectedSnapshot.sealedAt) : null}
                />
              )}
            </div>
          </ErrorBoundary>
        )}
        {serviceTab === 'timeline' && (
          <ErrorBoundary title="Timeline" retryLabel="Refresh">
            <SnapshotTimeline
              serverId={server.id}
              onRestore={(snap) => {
                setSelectedSnapshot(snap);
                setRecoveryTarget({ snap, node: null });
              }}
              onSelectSnapshot={(snap) => {
                setSelectedSnapshot(snap);
                if (snap) setServiceTab('files');
              }}
              selectedSnapshot={selectedSnapshot}
              verification={liveIndexMeta.latestVerification}
              sseConnected={sseConnected}
              latestSnapshot={latestSnapshot}
            />
          </ErrorBoundary>
        )}
        {serviceTab === 'activity' && (
          <ErrorBoundary title="Activity" retryLabel="Refresh">
            <ActivityLog
              entries={activityLog}
              agentStatus={liveIndexMeta.agentStatus}
              connected={sseConnected}
            />
          </ErrorBoundary>
        )}
        {serviceTab === 'monitoring' && (
          <ErrorBoundary title="Monitoring" retryLabel="Refresh">
            <MonitoringTab serverId={server.id} />
          </ErrorBoundary>
        )}
        {serviceTab === 'settings' && (
          <ErrorBoundary title="Settings" retryLabel="Refresh">
            <FolderConfigPanel serverId={server.id} />
          </ErrorBoundary>
        )}
        {isSystemAdmin && serviceTab === 'logs' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <select className="input max-w-[180px]" value={logComponent} onChange={e => { setLogComponent(e.target.value); setLogsSince(null); setLogs([]); }}>
                <option value="">All Components</option>
                <option value="Agent">Agent</option>
                <option value="Buffer">Buffer</option>
              </select>
              <select className="input max-w-[140px]" value={logLevel} onChange={e => { setLogLevel(e.target.value); setLogsSince(null); setLogs([]); }}>
                <option value="">All Levels</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>
            <div className="rounded-xl2 border border-border bg-panel divide-y divide-border">
              {logs.map(l => (
                <div key={l.id} className="px-3 py-2 text-xs">
                  <div className="font-mono text-text2">
                    [{l.machineId}][{l.component}]: [{l.eventCode}] {l.message}
                  </div>
                  <div className="text-text4 mt-1">
                    {formatDateTime(l.createdAt)} · {l.level}
                  </div>
                </div>
              ))}
              {logs.length === 0 && <div className="px-3 py-4 text-xs text-text4">No logs yet</div>}
            </div>
          </div>
        )}
      </main>

      {recoveryTarget && (
        <RecoveryWizard
          snapshot={recoveryTarget}
          onClose={() => setRecoveryTarget(null)}
        />
      )}
    </div>
  );
}
