import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchArchiveSnapshots,
  fetchFileEvents,
  fetchInventory,
  fetchInventoryMeta,
} from '../api/bufferClient.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import AgentIndexBanner from './AgentIndexBanner.jsx';
import FileListItem from './FileListItem.jsx';

function fmtBytes(n) {
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GiB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(2)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${n} B`;
}

function resolvePathId(fullPath, roots) {
  if (!fullPath || !roots?.length) return null;
  const sorted = [...roots].sort(
    (a, b) => (b.rootPath?.length || 0) - (a.rootPath?.length || 0),
  );
  for (const r of sorted) {
    if (r.rootPath && fullPath.startsWith(r.rootPath)) return r.pathId;
  }
  return null;
}

export default function InventoryPanel({ server, token }) {
  const { t, formatDateTime } = useI18n();
  const [page, setPage] = useState(1);
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [detailPath, setDetailPath] = useState(null);
  const [events, setEvents] = useState([]);
  const [snaps, setSnaps] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const pageSize = inv?.pageSize ?? 1000;
  const totalFiles = inv?.totalFiles ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalFiles / pageSize) || 1);

  const load = useCallback(async () => {
    if (!token || !server?.id) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchInventory(server.id, token, page, 1000);
      setInv(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, server?.id, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token || !server?.id) return;
    const id = setInterval(async () => {
      try {
        const data = await fetchInventoryMeta(server.id, token);
        setInv((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            agentStatus: data.agentStatus ?? prev.agentStatus,
            totalFiles: data.totalFiles ?? prev.totalFiles,
            roots: data.roots ?? prev.roots,
          };
        });
      } catch {
        /* ignore */
      }
    }, 1000);
    return () => clearInterval(id);
  }, [token, server?.id]);

  const roots = inv?.roots ?? [];
  const files = inv?.files ?? [];

  useEffect(() => {
    if (!detailPath || !token || !server?.id) {
      setEvents([]);
      setSnaps([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const pathId = resolvePathId(detailPath, roots);
        const [ev, sn] = await Promise.all([
          fetchFileEvents(server.id, token, { path: detailPath, limit: 200 }),
          pathId
            ? fetchArchiveSnapshots(server.id, token, { pathId, limit: 50 })
            : Promise.resolve([]),
        ]);
        if (!cancelled) {
          setEvents(Array.isArray(ev) ? ev : []);
          setSnaps(Array.isArray(sn) ? sn : []);
        }
      } catch {
        if (!cancelled) {
          setEvents([]);
          setSnaps([]);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailPath, token, server?.id, roots]);

  return (
    <div className="space-y-6">
      {err && (
        <div className="px-4 py-2.5 bg-warnLight border border-warn/25 rounded-xl2 text-warn text-xs">
          {err}
        </div>
      )}

      <AgentIndexBanner
        serverName={server.name}
        agentStatus={inv?.agentStatus}
        rootsCount={roots.length}
        totalFiles={totalFiles}
        latestVerification={inv?.latestVerification ?? null}
        loading={loading}
        variant="spotlight"
      />

      <section className="rounded-xl2 border border-border bg-panel overflow-hidden">
        <div className="px-4 py-2 border-b border-border bg-surface text-xs text-text3 font-medium">
          {t('backups.inventoryRoots')}
        </div>
        <div className="p-3 space-y-2">
          {roots.length === 0 && !loading && (
            <p className="text-xs text-text4">{t('backups.inventoryRootsEmpty')}</p>
          )}
          {roots.map((r) => (
            <div
              key={r.pathId}
              className="flex flex-wrap items-center justify-between gap-2 text-xs rounded-lg border border-border/60 px-3 py-2 bg-surface/50"
            >
              <span className="font-mono text-text2 break-all">{r.rootPath}</span>
              <span className="shrink-0 flex items-center gap-2">
                {!r.hasArchiveHistory && (
                  <span className="badge bg-warnLight text-warn">{t('backups.inventoryNoArchiveYet')}</span>
                )}
                <span className="text-text4">
                  {t('backups.inventorySnapCount', { count: r.snapshotCount ?? 0 })}
                </span>
              </span>
            </div>
          ))}
          <p className="text-xs text-text4 pt-1">{t('backups.inventoryArchiveHint')}</p>
        </div>
      </section>

      <section className="rounded-xl2 border border-border bg-panel overflow-hidden shadow-card">
        <div className="px-4 py-2 border-b border-border bg-surface flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-text3 font-medium">{t('backups.inventoryFiles')}</span>
          <span className="text-xs text-text4">
            {t('backups.inventoryFilesPage', { page, pages: totalPages, total: totalFiles })}
          </span>
        </div>
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
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8 text-text4 text-xs">…</div>
          )}
          {!loading &&
            files.map((r) => (
              <div
                key={r.fullPath}
                className={`cursor-pointer ${detailPath === r.fullPath ? 'ring-1 ring-accent/30 ring-inset' : ''}`}
                onClick={() => setDetailPath(r.fullPath)}
              >
                <FileListItem file={r} formatDateTime={formatDateTime} />
              </div>
            ))}
          {!loading && files.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-text4">
              <svg className="w-10 h-10 mb-3 text-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
              </svg>
              <p className="text-sm">{t('backups.inventoryFilesEmpty')}</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border bg-surface/40">
          <button
            type="button"
            className="btn-ghost text-xs py-1"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('backups.inventoryPrev')}
          </button>
          <button
            type="button"
            className="btn-ghost text-xs py-1"
            disabled={loading || !inv?.hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('backups.inventoryNext')}
          </button>
        </div>
      </section>

      {detailPath && (
        <section className="rounded-xl2 border border-accent/30 bg-panel overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-surface flex justify-between items-start gap-2">
            <div>
              <div className="text-xs font-medium text-text2">{t('backups.inventoryDetailTitle')}</div>
              <div className="font-mono text-xs text-text3 break-all mt-1">{detailPath}</div>
            </div>
            <button type="button" className="btn-ghost text-xs shrink-0" onClick={() => setDetailPath(null)}>
              {t('backups.inventoryCloseDetail')}
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="p-3 min-h-[120px]">
              <div className="text-xs text-text4 mb-2">{t('backups.inventoryColActivity')}</div>
              {detailLoading && <p className="text-xs text-text4">…</p>}
              {!detailLoading && events.length === 0 && (
                <p className="text-xs text-text4">{t('backups.inventoryEmptyEvents')}</p>
              )}
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {events.map((e) => (
                  <li key={e.id} className="text-xs border-b border-border/40 pb-2 last:border-0">
                    <span className="text-text2">{e.status}</span>
                    {e.previousStatus != null && (
                      <span className="text-text4">
                        {' '}
                        ← {e.previousStatus}
                      </span>
                    )}
                    <div className="text-text4 mt-0.5">{formatDateTime(e.occurredAt)}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-3 min-h-[120px]">
              <div className="text-xs text-text4 mb-2">{t('backups.inventoryColArchive')}</div>
              {detailLoading && <p className="text-xs text-text4">…</p>}
              {!detailLoading && snaps.length === 0 && (
                <p className="text-xs text-text4">{t('backups.inventoryEmptySnaps')}</p>
              )}
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {snaps.map((s) => (
                  <li key={s.objectName} className="text-xs border-b border-border/40 pb-2 last:border-0 font-mono">
                    <div className="text-text2 break-all">{s.objectName}</div>
                    <div className="text-text4 mt-0.5">
                      {formatDateTime(s.sealedAt)} · {s.flag} · {fmtBytes(s.sizeBytes)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
