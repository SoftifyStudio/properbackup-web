import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';

const BASE_URL = bufferBaseUrl();

const INTERVAL_OPTIONS = [
  { value: 1, labelKey: 'schedule.interval1m' },
  { value: 5, labelKey: 'schedule.interval5m' },
  { value: 15, labelKey: 'schedule.interval15m' },
  { value: 30, labelKey: 'schedule.interval30m' },
  { value: 60, labelKey: 'schedule.interval1h' },
  { value: 360, labelKey: 'schedule.interval6h' },
  { value: 1440, labelKey: 'schedule.interval24h' },
];

const IO_THROTTLE_OPTIONS = [
  { value: 0, labelKey: 'schedule.throttleNone' },
  { value: 10, labelKey: 'schedule.throttle10' },
  { value: 25, labelKey: 'schedule.throttle25' },
  { value: 50, labelKey: 'schedule.throttle50' },
  { value: 100, labelKey: 'schedule.throttle100' },
];

export default function BackupScheduleSettings({ serverId }) {
  const { token } = useAuth();
  const { t } = useI18n();

  const [config, setConfig] = useState({
    intervalMinutes: 5,
    ioThrottleMbps: 0,
    windowEnabled: false,
    windowStart: '00:00',
    windowEnd: '06:00',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    if (!token || !serverId) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/servers/${encodeURIComponent(serverId)}/schedule-config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(prev => ({ ...prev, ...data }));
      }
    } catch {
      // endpoint may not exist yet — use defaults
    } finally {
      setLoading(false);
    }
  }, [token, serverId]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const saveConfig = useCallback(async () => {
    if (!token || !serverId) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/servers/${encodeURIComponent(serverId)}/schedule-config`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [token, serverId, config]);

  const update = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-text3 text-sm py-8 justify-center">
        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        {t('schedule.loading')}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-panel p-6 shadow-card space-y-6">
      <h2 className="text-lg font-bold text-text1">{t('schedule.title')}</h2>

      <div>
        <label className="text-sm font-medium text-text2 block mb-2">
          {t('schedule.backupInterval')}
        </label>
        <div className="flex flex-wrap gap-2">
          {INTERVAL_OPTIONS.map(({ value, labelKey }) => (
            <button
              key={value}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
                config.intervalMinutes === value
                  ? 'bg-accent text-white border-accent shadow-sm'
                  : 'bg-surface text-text3 border-border hover:text-text2 hover:border-accent/40'
              }`}
              onClick={() => update('intervalMinutes', value)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <p className="text-xs text-text4 mt-1.5">{t('schedule.intervalDesc')}</p>
      </div>

      <div>
        <label className="text-sm font-medium text-text2 block mb-2">
          {t('schedule.ioThrottle')}
        </label>
        <div className="flex flex-wrap gap-2">
          {IO_THROTTLE_OPTIONS.map(({ value, labelKey }) => (
            <button
              key={value}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
                config.ioThrottleMbps === value
                  ? 'bg-accent text-white border-accent shadow-sm'
                  : 'bg-surface text-text3 border-border hover:text-text2 hover:border-accent/40'
              }`}
              onClick={() => update('ioThrottleMbps', value)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <p className="text-xs text-text4 mt-1.5">{t('schedule.ioThrottleDesc')}</p>
      </div>

      <div className="border-t border-border pt-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-text1">{t('schedule.backupWindow')}</p>
            <p className="text-xs text-text4 mt-0.5">{t('schedule.backupWindowDesc')}</p>
          </div>
          <button
            className={`relative w-11 h-6 rounded-full transition-colors ${config.windowEnabled ? 'bg-accent' : 'bg-gray-300'}`}
            onClick={() => update('windowEnabled', !config.windowEnabled)}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              config.windowEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        {config.windowEnabled && (
          <div className="flex items-center gap-3 ml-1">
            <div>
              <label className="text-[10px] text-text4 uppercase tracking-wide block mb-0.5">
                {t('schedule.windowFrom')}
              </label>
              <input
                type="time"
                className="input text-sm px-3 py-1.5 w-28"
                value={config.windowStart}
                onChange={(e) => update('windowStart', e.target.value)}
              />
            </div>
            <span className="text-text4 mt-4">–</span>
            <div>
              <label className="text-[10px] text-text4 uppercase tracking-wide block mb-0.5">
                {t('schedule.windowTo')}
              </label>
              <input
                type="time"
                className="input text-sm px-3 py-1.5 w-28"
                value={config.windowEnd}
                onChange={(e) => update('windowEnd', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          className="px-5 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          onClick={saveConfig}
          disabled={saving}
        >
          {saving ? t('schedule.saving') : t('schedule.save')}
        </button>
        {saved && (
          <span className="text-xs text-emerald-600 font-medium">{t('schedule.saved')}</span>
        )}
      </div>
    </div>
  );
}
