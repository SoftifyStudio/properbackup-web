import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { fetchFileStatesAt } from '../api/bufferClient.js';
import { useI18n } from '../i18n/I18nContext.jsx';

function fmtBytes(n) {
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

/**
 * File selector for partial recovery — lets user pick specific files
 * from a snapshot to restore.
 *
 * @param {string} serverId
 * @param {object} snapshot - snapshot object with sealedAt timestamp
 * @param {string[]} selectedPaths - currently selected file paths
 * @param {function} onSelectionChange - callback with updated paths array
 */
export default function RecoveryFileSelector({ serverId, snapshot, selectedPaths, onSelectionChange }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectAll, setSelectAll] = useState(true);

  const loadFiles = useCallback(async () => {
    if (!serverId || !snapshot?.sealedAt || !token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFileStatesAt(serverId, token, snapshot.sealedAt, 1, 5000);
      const fileList = (data.files ?? data ?? []).filter(f => f.flag === 'A');
      setFiles(fileList);
      if (selectAll) {
        onSelectionChange(fileList.map(f => f.path));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [serverId, snapshot?.sealedAt, token, selectAll, onSelectionChange]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);

  const filtered = useMemo(() => {
    if (!search.trim()) return files;
    const q = search.toLowerCase();
    return files.filter(f => f.path?.toLowerCase().includes(q));
  }, [files, search]);

  const toggleFile = useCallback((path) => {
    setSelectAll(false);
    const next = selectedSet.has(path)
      ? selectedPaths.filter(p => p !== path)
      : [...selectedPaths, path];
    onSelectionChange(next);
  }, [selectedSet, selectedPaths, onSelectionChange]);

  const toggleAll = useCallback(() => {
    if (selectAll || selectedPaths.length === files.length) {
      setSelectAll(false);
      onSelectionChange([]);
    } else {
      setSelectAll(true);
      onSelectionChange(files.map(f => f.path));
    }
  }, [selectAll, selectedPaths.length, files, onSelectionChange]);

  const allSelected = selectedPaths.length === files.length && files.length > 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface/60 border-b border-border">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-3.5 h-3.5 accent-accent"
            />
            <span className="text-xs font-semibold text-text2">
              {t('recovery.mode.fileSelector.selectAll')}
            </span>
          </label>
          <span className="text-[10px] text-text4">
            {selectedPaths.length} / {files.length} {t('recovery.mode.fileSelector.selected')}
          </span>
        </div>
        <input
          type="text"
          placeholder={t('recovery.mode.fileSelector.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-md bg-panel border border-border text-text1 w-48 focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
      </div>

      <div className="max-h-60 overflow-y-auto">
        {loading && (
          <div className="flex items-center gap-2 justify-center py-8 text-text3 text-xs">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            {t('recovery.mode.fileSelector.loading')}
          </div>
        )}

        {error && (
          <div className="px-4 py-3 text-xs text-red-600">{error}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="px-4 py-6 text-xs text-text4 text-center">
            {t('recovery.mode.fileSelector.noFiles')}
          </div>
        )}

        {!loading && filtered.map((file) => (
          <label
            key={file.path}
            className="flex items-center gap-3 px-4 py-2 hover:bg-surface/40 cursor-pointer border-b border-border/40 last:border-b-0"
          >
            <input
              type="checkbox"
              checked={selectedSet.has(file.path)}
              onChange={() => toggleFile(file.path)}
              className="w-3.5 h-3.5 accent-accent shrink-0"
            />
            <span className="text-xs text-text1 font-mono truncate flex-1" title={file.path}>
              {file.path}
            </span>
            <span className="text-[10px] text-text4 shrink-0 tabular-nums">
              {fmtBytes(file.sizeBytes ?? 0)}
            </span>
          </label>
        ))}
      </div>

      {files.length > 0 && (
        <div className="px-4 py-2 bg-surface/40 border-t border-border text-[10px] text-text4">
          {t('recovery.mode.fileSelector.summary', {
            selected: selectedPaths.length,
            total: files.length,
            size: fmtBytes(files.filter(f => selectedSet.has(f.path)).reduce((a, f) => a + (f.sizeBytes ?? 0), 0)),
          })}
        </div>
      )}
    </div>
  );
}
