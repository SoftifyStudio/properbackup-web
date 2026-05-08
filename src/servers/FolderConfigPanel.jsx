import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const BASE_URL = bufferBaseUrl();

export default function FolderConfigPanel({ serverId }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPath, setNewPath] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const loadConfig = useCallback(async () => {
    if (!token || !serverId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/servers/${serverId}/backup-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPaths(data.paths || []);
    } catch {
      // Silent fallback — no error banner
    } finally {
      setLoading(false);
    }
  }, [token, serverId]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const addPath = async () => {
    const trimmed = newPath.trim();
    if (!trimmed) return;
    setAdding(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/servers/${serverId}/backup-config`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderPath: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewPath('');
      await loadConfig();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const removePath = async (folderPath) => {
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/servers/${serverId}/backup-config`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderPath }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadConfig();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-base font-semibold text-text1 mb-1">{t('folderConfig.title')}</h2>
      <p className="text-sm text-text3 mb-2">{t('folderConfig.description')}</p>

      {/* Default: entire system info */}
      <div className="px-4 py-3 bg-accent/5 border border-accent/15 rounded-xl2 mb-5 text-xs">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 5v3M8 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div>
            <p className="text-text1 font-medium mb-0.5">
              {paths.length === 0 ? 'Default: entire system backup' : `${paths.length} custom folder(s) configured`}
            </p>
            <p className="text-text3">
              {paths.length === 0
                ? 'The agent will back up the entire filesystem by default. Add specific folders below to limit the scope.'
                : 'Only the folders listed below will be backed up. Remove all to revert to full-system backup.'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          className="input flex-1"
          placeholder={t('folderConfig.placeholder')}
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPath()}
        />
        <button
          className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          onClick={addPath}
          disabled={adding || !newPath.trim()}
        >
          {adding ? '…' : t('folderConfig.add')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-text3 text-sm py-4">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          {t('folderConfig.loading')}
        </div>
      ) : paths.length === 0 ? (
        <div className="text-text4 text-sm py-4">
          {t('folderConfig.empty')}
        </div>
      ) : (
        <ul className="space-y-2">
          {paths.map((p) => (
            <li key={p.folderPath} className="flex items-center justify-between px-4 py-3 bg-panel border border-border rounded-lg">
              <div className="flex items-center gap-3 min-w-0">
                <svg className="w-4 h-4 text-accent shrink-0" viewBox="0 0 16 16" fill="none">
                  <path d="M1.5 5a1.5 1.5 0 011.5-1.5h3.5l1 1.5h5a1.5 1.5 0 011.5 1.5v5a1.5 1.5 0 01-1.5 1.5h-10A1.5 1.5 0 011.5 11.5v-6.5z" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
                <span className="text-sm text-text1 font-mono truncate">{p.folderPath}</span>
              </div>
              <button
                className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0 ml-3"
                onClick={() => removePath(p.folderPath)}
              >
                {t('folderConfig.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
