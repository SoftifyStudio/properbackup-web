import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { fetchMonitoringServers, fetchNotificationSettings, updateNotificationSettings } from '../api/monitoringClient.js';

const STATUS_CONFIG = {
  ONLINE:  { color: 'bg-emerald-500', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', label: 'Online' },
  WARNING: { color: 'bg-amber-500',   textColor: 'text-amber-700',   bgColor: 'bg-amber-50',   borderColor: 'border-amber-200',   label: 'Warning' },
  OFFLINE: { color: 'bg-red-500',     textColor: 'text-red-700',     bgColor: 'bg-red-50',     borderColor: 'border-red-200',     label: 'Offline' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.OFFLINE;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bgColor} ${cfg.textColor} border ${cfg.borderColor}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.color} ${status === 'ONLINE' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}

function relativeTime(isoStr) {
  if (!isoStr) return '—';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AgentHealthDashboard() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notifSettings, setNotifSettings] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [srvData, notifData] = await Promise.all([
        fetchMonitoringServers(token),
        fetchNotificationSettings(token),
      ]);
      setServers(srvData.servers || []);
      setNotifSettings(notifData);
      setEmailEnabled(notifData.emailEnabled || false);
      setEmailInput(notifData.emailAddress || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const saveNotificationSettings = async () => {
    setSaving(true);
    try {
      const updated = await updateNotificationSettings(token, {
        emailEnabled,
        emailAddress: emailInput.trim() || null,
        smsEnabled: false,
        smsNumber: null,
      });
      setNotifSettings(updated);
      setShowSettings(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onlineCount = servers.filter(s => s.status === 'ONLINE').length;
  const warningCount = servers.filter(s => s.status === 'WARNING').length;
  const offlineCount = servers.filter(s => s.status === 'OFFLINE').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text1">{t('monitoring.title')}</h2>
          <p className="text-xs text-text4 mt-0.5">{t('monitoring.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost text-xs py-1.5 px-3"
            onClick={() => setShowSettings(!showSettings)}
          >
            {t('monitoring.notificationSettings')}
          </button>
          <button className="btn-ghost text-xs py-1.5 px-3" onClick={loadData} disabled={loading}>
            {loading ? '...' : t('monitoring.refresh')}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <div className="text-[11px] text-emerald-600 font-medium uppercase">Online</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{onlineCount}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="text-[11px] text-amber-600 font-medium uppercase">Warning</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{warningCount}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <div className="text-[11px] text-red-600 font-medium uppercase">Offline</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{offlineCount}</div>
        </div>
      </div>

      {/* Notification settings panel */}
      {showSettings && (
        <div className="bg-panel border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-text1 mb-3">{t('monitoring.notificationSettings')}</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
              />
              <span className="text-sm text-text2">{t('monitoring.enableEmailNotifications')}</span>
            </label>
            {emailEnabled && (
              <div className="ml-7">
                <label className="text-xs text-text4 block mb-1">{t('monitoring.notificationEmail')}</label>
                <input
                  type="email"
                  className="input text-sm w-full max-w-sm"
                  placeholder="admin@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
              </div>
            )}
            <div className="ml-7 flex items-center gap-2">
              <button
                className="btn-primary text-xs py-1.5 px-4"
                onClick={saveNotificationSettings}
                disabled={saving}
              >
                {saving ? t('monitoring.saving') : t('monitoring.save')}
              </button>
              <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => setShowSettings(false)}>
                {t('monitoring.cancel')}
              </button>
            </div>
            <p className="text-[11px] text-text4 ml-7">{t('monitoring.smsComingSoon')}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading && servers.length === 0 && (
        <div className="flex items-center justify-center py-16 text-text4 text-sm">{t('monitoring.loading')}</div>
      )}

      {!loading && servers.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-text4">
          <svg className="w-12 h-12 mb-3 text-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          <p className="text-sm font-medium text-text3">{t('monitoring.noServers')}</p>
          <p className="text-xs text-text4 mt-1">{t('monitoring.noServersHint')}</p>
        </div>
      )}

      {/* Server list */}
      {servers.length > 0 && (
        <div className="bg-panel border border-border rounded-xl divide-y divide-border overflow-hidden">
          {servers.map((srv) => (
            <div
              key={srv.serverId}
              className="flex items-center gap-4 px-5 py-4 hover:bg-surface/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text1 truncate">{srv.serverName}</span>
                  <StatusBadge status={srv.status} />
                </div>
                <div className="text-xs text-text4 mt-1">
                  {t('monitoring.lastSeen')}: {relativeTime(srv.lastSeenAt)}
                </div>
              </div>
              {srv.status === 'OFFLINE' && (
                <div className="shrink-0 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                  {t('monitoring.offlineWarning')}
                </div>
              )}
              {srv.status === 'WARNING' && (
                <div className="shrink-0 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                  {t('monitoring.warningHint')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
