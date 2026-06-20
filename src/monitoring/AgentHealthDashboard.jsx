import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';

const BASE_URL = bufferBaseUrl();

const STATUS_CONFIG = {
  ONLINE: {
    label: 'monitoring.statusOnline',
    dot: 'bg-emerald-500 animate-pulse',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
  },
  WARNING: {
    label: 'monitoring.statusWarning',
    dot: 'bg-amber-500 animate-pulse',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
  },
  OFFLINE: {
    label: 'monitoring.statusOffline',
    dot: 'bg-red-500',
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
  },
};

function classifyAgent(lastSeen) {
  if (!lastSeen) return 'OFFLINE';
  const diff = (Date.now() - new Date(lastSeen).getTime()) / 60000;
  if (diff <= 5) return 'ONLINE';
  if (diff <= 30) return 'WARNING';
  return 'OFFLINE';
}

function formatAgo(dateStr) {
  if (!dateStr) return 'Never';
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusBadge({ status }) {
  const { t } = useI18n();
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.OFFLINE;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {t(cfg.label)}
    </span>
  );
}

function ServerHealthCard({ server, onSelect }) {
  const { t } = useI18n();
  const status = classifyAgent(server.lastSeenAt);

  return (
    <div
      className={`rounded-xl border bg-panel p-4 shadow-card cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 ${
        status === 'OFFLINE' ? 'border-red-200' : status === 'WARNING' ? 'border-amber-200' : 'border-border'
      }`}
      onClick={() => onSelect?.(server)}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-text1 truncate">{server.name}</h3>
        <StatusBadge status={status} />
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-text4">{t('monitoring.lastHeartbeat')}</span>
          <span className="text-text2 font-medium">{formatAgo(server.lastSeenAt)}</span>
        </div>
        {server.agentPhase && (
          <div className="flex justify-between">
            <span className="text-text4">{t('monitoring.agentPhase')}</span>
            <span className="text-text2 font-medium capitalize">{server.agentPhase}</span>
          </div>
        )}
        {server.totalFiles != null && (
          <div className="flex justify-between">
            <span className="text-text4">{t('monitoring.filesProtected')}</span>
            <span className="text-text2 font-medium">{server.totalFiles.toLocaleString()}</span>
          </div>
        )}
      </div>

      {status === 'OFFLINE' && (
        <div className="mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-[10px] text-red-600 font-medium">{t('monitoring.offlineWarning')}</p>
        </div>
      )}
    </div>
  );
}

export default function AgentHealthDashboard({ servers, onSelectServer }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [healthData, setHealthData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadHealth = useCallback(async () => {
    if (!token || !servers?.length) {
      setHealthData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.all(
        servers.map(async (srv) => {
          try {
            const res = await fetch(`${BASE_URL}/health/inventory-summary?serverId=${encodeURIComponent(srv.id)}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return { ...srv, agentPhase: null, totalFiles: null };
            const data = await res.json();
            return {
              ...srv,
              agentPhase: data.agentStatus?.phase ?? null,
              totalFiles: data.totalFiles ?? null,
              scannedFiles: data.agentStatus?.scannedFiles ?? null,
            };
          } catch {
            return { ...srv, agentPhase: null, totalFiles: null };
          }
        })
      );
      setHealthData(results);
    } catch {
      setHealthData(servers);
    } finally {
      setLoading(false);
    }
  }, [token, servers]);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  useEffect(() => {
    const interval = setInterval(loadHealth, 30000);
    return () => clearInterval(interval);
  }, [loadHealth]);

  const counts = {
    ONLINE: healthData.filter(s => classifyAgent(s.lastSeenAt) === 'ONLINE').length,
    WARNING: healthData.filter(s => classifyAgent(s.lastSeenAt) === 'WARNING').length,
    OFFLINE: healthData.filter(s => classifyAgent(s.lastSeenAt) === 'OFFLINE').length,
  };

  const filtered = filter === 'all'
    ? healthData
    : healthData.filter(s => classifyAgent(s.lastSeenAt) === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-text1">{t('monitoring.title')}</h2>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-text3">
            <span className="font-semibold text-emerald-600">{counts.ONLINE}</span> {t('monitoring.statusOnline')}
          </span>
          {counts.WARNING > 0 && (
            <span className="text-text3">
              <span className="font-semibold text-amber-600">{counts.WARNING}</span> {t('monitoring.statusWarning')}
            </span>
          )}
          {counts.OFFLINE > 0 && (
            <span className="text-text3">
              <span className="font-semibold text-red-600">{counts.OFFLINE}</span> {t('monitoring.statusOffline')}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 bg-surface rounded-lg p-0.5 border border-border/50 w-fit">
        {[
          { key: 'all', label: t('monitoring.filterAll'), count: healthData.length },
          { key: 'ONLINE', label: t('monitoring.statusOnline'), count: counts.ONLINE },
          { key: 'WARNING', label: t('monitoring.statusWarning'), count: counts.WARNING },
          { key: 'OFFLINE', label: t('monitoring.statusOffline'), count: counts.OFFLINE },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium ${
              filter === key ? 'bg-panel text-accent shadow-sm border border-accent/20' : 'text-text3 hover:text-text2'
            }`}
            onClick={() => setFilter(key)}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-text3 text-sm py-8 justify-center">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          {t('monitoring.loading')}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-12 text-text4">
          <p className="text-sm font-medium">{t('monitoring.noServers')}</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((srv) => (
            <ServerHealthCard key={srv.id} server={srv} onSelect={onSelectServer} />
          ))}
        </div>
      )}

      {counts.OFFLINE > 0 && !loading && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-700">{t('monitoring.offlineAlert')}</p>
          <p className="text-xs text-red-600 mt-1">{t('monitoring.offlineAlertDesc')}</p>
        </div>
      )}
    </div>
  );
}
