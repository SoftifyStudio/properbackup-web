import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import FileListItem from './FileListItem.jsx';
import FolderConfigPanel from './FolderConfigPanel.jsx';
import { fetchInventory, fetchInventoryMeta, forceFlush } from '../api/bufferClient.js';
import { useSearchParams } from 'react-router-dom';

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
  const [fileStates, setFileStates]         = useState(() => {
    const now = new Date();
    const ago = (mins) => new Date(now.getTime() - mins * 60_000).toISOString();
    return [
      { fullPath: '/home/daniel/mc-server/world/level.dat', status: 'current', updatedAt: ago(2) },
      { fullPath: '/home/daniel/mc-server/world/region/r.0.0.mca', status: 'changed', updatedAt: ago(5) },
      { fullPath: '/home/daniel/mc-server/server.properties', status: 'current', updatedAt: ago(12) },
      { fullPath: '/home/daniel/mc-server/plugins/EssentialsX.jar', status: 'current', updatedAt: ago(60) },
      { fullPath: '/home/daniel/mc-server/logs/latest.log', status: 'changed', updatedAt: ago(1) },
      { fullPath: '/var/www/wordpress/wp-config.php', status: 'current', updatedAt: ago(180) },
      { fullPath: '/var/www/wordpress/wp-content/uploads/photo-2026.jpg', status: 'current', updatedAt: ago(300) },
      { fullPath: '/var/www/wordpress/wp-content/themes/flavor/style.css', status: 'current', updatedAt: ago(420) },
      { fullPath: '/etc/nginx/nginx.conf', status: 'current', updatedAt: ago(1440) },
      { fullPath: '/home/daniel/projects/api/src/main/kotlin/App.kt', status: 'changed', updatedAt: ago(8) },
      { fullPath: '/home/daniel/projects/api/build.gradle.kts', status: 'current', updatedAt: ago(90) },
      { fullPath: '/home/daniel/projects/api/docker-compose.yml', status: 'current', updatedAt: ago(200) },
      { fullPath: '/home/daniel/backups/db-dump-2026-05-05.sql', status: 'current', updatedAt: ago(720) },
      { fullPath: '/home/daniel/Documents/Audit-Report-May.pdf', status: 'current', updatedAt: ago(1200) },
      { fullPath: '/home/daniel/mc-server/world/playerdata/uuid.dat', status: 'deleted', updatedAt: ago(30) },
      { fullPath: '/opt/properbackup/config.json', status: 'current', updatedAt: ago(2000) },
      { fullPath: '/home/daniel/projects/webapp/package.json', status: 'changed', updatedAt: ago(15) },
      { fullPath: '/home/daniel/projects/webapp/src/App.tsx', status: 'current', updatedAt: ago(45) },
      { fullPath: '/home/daniel/mc-server/backups/world-2026-05-04.tar.gz', status: 'current', updatedAt: ago(1500) },
      { fullPath: '/home/daniel/Music/podcast-ep42.mp3', status: 'current', updatedAt: ago(3000) },
      { fullPath: '/home/daniel/Screenshots/screen-2026-05-01.png', status: 'current', updatedAt: ago(5000) },
    ];
  });
  const [fileSortMode, setFileSortMode]     = useState('recent');
  const [liveIndexMeta, setLiveIndexMeta]   = useState({
    agentStatus: null,
    rootsCount: 0,
    totalFiles: 0,
    loading: false,
  });
  const [logsSince, setLogsSince]           = useState(null);
  const [logLevel, setLogLevel]             = useState('');
  const [logComponent, setLogComponent]     = useState('');
  const [showDebug, setShowDebug]           = useState(false);
  const urlTab = searchParams.get('tab');
  const isAllowedTab = ['backups', 'inventory', 'logs', 'files', 'docs', 'settings'].includes(urlTab || '');
  const serviceTab = isAllowedTab ? urlTab : 'backups';

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
      } else {
        setError(t('backups.pathsIdxPartial', { status: idxRes.status }));
      }

      setPathsIdx(paths);
      setUpdatedAt(updated);
      setObjectNames(objects ?? []);
      setMode('live');
    } catch (e) {
      setError(t('backups.bufferError', { message: e.message }));
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
      const logsUrl = new URL(`${BASE_URL}/admin/logs`);
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

  /** Co ~1 s: tylko agentStatus i liczniki (lekki GET inventory pageSize 1). */
  const fetchLiveMeta = useCallback(async () => {
    if (!token) return;
    try {
      const inv = await fetchInventoryMeta(server.id, token);
      setLiveIndexMeta((m) => ({
        ...m,
        agentStatus: inv.agentStatus ?? null,
        rootsCount: inv.roots?.length ?? 0,
        totalFiles: inv.totalFiles ?? 0,
      }));
    } catch {
      /* zostaw poprzedni stan */
    }
  }, [token, server.id]);

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
  const filesPollMs = isIndexing ? 2000 : 4000;

  useEffect(() => {
    fetchLiveFileStates(true);
    const metaId = setInterval(fetchLiveMeta, 1000);
    const filesId = setInterval(() => fetchLiveFileStates(false), filesPollMs);
    return () => {
      clearInterval(metaId);
      clearInterval(filesId);
    };
  }, [fetchLiveFileStates, fetchLiveMeta, filesPollMs]);

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
      <AppHeader onBack={onBack} backLabel={t('backups.backLabel')}>
        <span className="badge bg-accentLight text-accent text-xs">{server.name}</span>
        <span className={`badge text-xs ${mode === 'live' ? 'bg-successLight text-success' : 'bg-surface text-text3 border border-border'}`}>
          {mode === 'live' ? t('backups.modeLive') : t('backups.modeFixture')}
        </span>
      </AppHeader>
      {isSystemAdmin && <AdminModeBar variant="server" server={server} />}

      <StatusBar
        nodeCount={nodes.length}
        snapshotCount={snapshotCount}
        orphanCount={orphanCount}
        updatedAt={updatedAt}
      />

      <div className="shrink-0 px-6 py-2 border-b border-border bg-panel flex items-center gap-2">
        <button
          className={`btn-ghost text-xs py-1.5 ${serviceTab === 'backups' ? 'ring-1 ring-accent/40' : ''}`}
          onClick={() => setServiceTab('backups')}
        >
          {t('backups.tabBackups')}
        </button>
        <button
          className={`btn-ghost text-xs py-1.5 ${serviceTab === 'inventory' ? 'ring-1 ring-accent/40' : ''}`}
          onClick={() => setServiceTab('inventory')}
        >
          {t('backups.tabInventory')}
        </button>
        {isSystemAdmin && (
          <button className={`btn-ghost text-xs py-1.5 ${serviceTab === 'logs' ? 'ring-1 ring-accent/40' : ''}`} onClick={() => setServiceTab('logs')}>
            {t('backups.tabLogs')}
          </button>
        )}
        <button className={`btn-ghost text-xs py-1.5 ${serviceTab === 'files' ? 'ring-1 ring-accent/40' : ''}`} onClick={() => setServiceTab('files')}>
          {t('backups.tabFiles')}
        </button>
        <button className={`btn-ghost text-xs py-1.5 ${serviceTab === 'docs' ? 'ring-1 ring-accent/40' : ''}`} onClick={() => setServiceTab('docs')}>
          {t('backups.tabDocs')}
        </button>
        <button className={`btn-ghost text-xs py-1.5 ${serviceTab === 'settings' ? 'ring-1 ring-accent/40' : ''}`} onClick={() => setServiceTab('settings')}>
          {t('backups.tabSettings')}
        </button>
        {mode === 'live' && (
          <button className="btn-ghost text-xs py-1.5" onClick={handleFlush}>
            {t('backups.flush')}
          </button>
        )}
        <button className="btn-ghost text-xs py-1.5 min-w-[90px]" onClick={fetchServerData} disabled={refreshing}>
          {refreshing ? t('backups.refreshBusy') : t('backups.refresh')}
        </button>
        <a
          href={`${BASE_URL}/servers/${server.id}/audit-report`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-xs py-1.5"
          onClick={(e) => {
            e.preventDefault();
            fetch(`${BASE_URL}/servers/${server.id}/audit-report`, {
              headers: { Authorization: `Bearer ${token}` },
            }).then(r => r.blob()).then(blob => {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `ProperBackup-Audit-Report-${server.id}.pdf`;
              a.click();
              URL.revokeObjectURL(url);
            }).catch(err => setError(err.message));
          }}
        >
          {t('backups.auditReport')}
        </a>
        {import.meta.env.DEV && (
          <button
            className={`btn-ghost text-xs py-1.5 ml-auto font-mono ${showDebug ? 'ring-1 ring-amber-400 bg-amber-50 text-amber-700' : 'text-text4'}`}
            onClick={() => setShowDebug(d => !d)}
            title="Toggle debug panel (dev only)"
          >
            {showDebug ? 'DEBUG ON' : 'DBG'}
          </button>
        )}
      </div>

      {error && (
        <div className="shrink-0 mx-6 mt-2 px-4 py-2.5 bg-warnLight border border-warn/25 rounded-xl2 text-warn text-xs">
          {error}
        </div>
      )}

      {showDebug && import.meta.env.DEV && (
        <div className="shrink-0 mx-6 mt-2 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-xs font-mono overflow-x-auto">
          <div className="font-sans font-semibold text-amber-800 mb-2">Debug Panel (dev only)</div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <span className="text-amber-600">agentStatus:</span>
            <pre className="text-amber-900 whitespace-pre-wrap break-all">{JSON.stringify(liveIndexMeta.agentStatus, null, 2)}</pre>
            <span className="text-amber-600">files.length:</span>
            <span className="text-amber-900">{fileStates.length}</span>
            <span className="text-amber-600">totalFiles:</span>
            <span className="text-amber-900">{liveIndexMeta.totalFiles}</span>
            <span className="text-amber-600">rootsCount:</span>
            <span className="text-amber-900">{liveIndexMeta.rootsCount}</span>
            <span className="text-amber-600">mode:</span>
            <span className="text-amber-900">{mode}</span>
            <span className="text-amber-600">pollInterval:</span>
            <span className="text-amber-900">{filesPollMs}ms</span>
          </div>
        </div>
      )}

      <main className={`flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-6 w-full mx-auto ${serviceTab === 'files' ? 'max-w-6xl' : 'max-w-4xl'}`}>
        {serviceTab === 'backups' && (
          <ErrorBoundary title={t('backups.tabBackups')} retryLabel={t('backups.refresh')}>
          <DirectoryView
            nodes={nodes}
            onRestore={(snap) => {
              const node = nodes.find(n => n.snapshots.includes(snap));
              setRecoveryTarget({ snap, node });
            }}
          />
          </ErrorBoundary>
        )}
        {serviceTab === 'inventory' && (
          <ErrorBoundary title={t('backups.tabInventory')} retryLabel={t('backups.refresh')}>
            <InventoryPanel server={server} token={token} />
          </ErrorBoundary>
        )}
        {isSystemAdmin && serviceTab === 'logs' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <select className="input max-w-[180px]" value={logComponent} onChange={e => { setLogComponent(e.target.value); setLogsSince(null); setLogs([]); }}>
                <option value="">{t('backups.logComponentAll')}</option>
                <option value="Installer">Installer</option>
                <option value="Agent">Agent</option>
                <option value="Buffer">Buffer</option>
                <option value="Web">Web</option>
                <option value="DB">DB</option>
              </select>
              <select className="input max-w-[140px]" value={logLevel} onChange={e => { setLogLevel(e.target.value); setLogsSince(null); setLogs([]); }}>
                <option value="">{t('backups.logLevelAll')}</option>
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
                    {l.dropped ? ` · ${t('backups.logDropped', { count: l.dropped })}` : ''}
                  </div>
                </div>
              ))}
              {logs.length === 0 && <div className="px-3 py-4 text-xs text-text4">{t('backups.logsEmpty')}</div>}
            </div>
          </div>
        )}
        {serviceTab === 'files' && (
          <ErrorBoundary title={t('backups.tabFiles')} retryLabel={t('backups.refresh')}>
          <div className="space-y-4">
            <AgentIndexBanner
              serverName={server.name}
              agentStatus={liveIndexMeta.agentStatus}
              rootsCount={liveIndexMeta.rootsCount}
              totalFiles={liveIndexMeta.totalFiles}
              loading={liveIndexMeta.loading}
              variant="spotlight"
            />

            {/* Toolbar: file count + sort toggle */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-text3">
                {fileStates.length > 0
                  ? t('backups.filesCount', { count: fileStates.length })
                  : ''}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text4">{t('backups.filesSortLabel')}</span>
                <button
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${fileSortMode === 'recent' ? 'bg-accent/15 text-accent font-semibold' : 'text-text3 hover:text-text2 hover:bg-surface/80'}`}
                  onClick={() => setFileSortMode('recent')}
                >
                  {t('backups.filesSortRecent')}
                </button>
                <button
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${fileSortMode === 'path' ? 'bg-accent/15 text-accent font-semibold' : 'text-text3 hover:text-text2 hover:bg-surface/80'}`}
                  onClick={() => setFileSortMode('path')}
                >
                  {t('backups.filesSortPath')}
                </button>
              </div>
            </div>

            {/* OneDrive-style file list */}
            <div className="rounded-xl2 border border-border bg-panel overflow-hidden shadow-card">
              {/* Column header */}
              <div className="flex items-center gap-3 px-4 py-2 bg-surface/90 border-b border-border">
                <span className="shrink-0 w-1.5" />
                <span className="shrink-0 w-5" />
                <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-text4">
                  {t('backups.filesColName')}
                </span>
                <div className="shrink-0 flex items-center gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text4 w-[5.5rem] text-center">
                    {t('backups.filesColStatus')}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-text4 w-[9rem] text-right">
                    {t('backups.filesColUpdated')}
                  </span>
                </div>
              </div>
              {/* File rows */}
              <div className="max-h-[70vh] overflow-y-auto">
                {fileStates.map(r => (
                  <FileListItem key={r.fullPath} file={r} formatDateTime={formatDateTime} />
                ))}
                {fileStates.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-text4">
                    <svg className="w-10 h-10 mb-3 text-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
                    </svg>
                    <p className="text-sm">{t('backups.filesEmpty')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          </ErrorBoundary>
        )}
        {serviceTab === 'docs' && (
          <ErrorBoundary title={t('backups.tabDocs')} retryLabel={t('backups.refresh')}>
            <DocumentationTab />
          </ErrorBoundary>
        )}
        {serviceTab === 'settings' && (
          <ErrorBoundary title={t('backups.tabSettings')} retryLabel={t('backups.refresh')}>
            <FolderConfigPanel serverId={server.id} />
          </ErrorBoundary>
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
