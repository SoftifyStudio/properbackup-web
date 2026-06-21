import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { fetchBackupSchedule, updateBackupSchedule } from '../api/monitoringClient.js';

const INTERVAL_PRESETS = [
  { label: '1 min', value: 1 },
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1h', value: 60 },
  { label: '6h', value: 360 },
  { label: '12h', value: 720 },
  { label: '24h', value: 1440 },
];

export default function BackupSchedulePanel({ serverId }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [ioThrottleMbps, setIoThrottleMbps] = useState('');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');

  const load = useCallback(async () => {
    if (!token || !serverId) return;
    setLoading(true);
    try {
      const data = await fetchBackupSchedule(serverId, token);
      setSchedule(data);
      setIntervalMinutes(data.intervalMinutes || 5);
      setIoThrottleMbps(data.ioThrottleMbps != null ? String(data.ioThrottleMbps) : '');
      setWindowStart(data.windowStart || '');
      setWindowEnd(data.windowEnd || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, serverId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateBackupSchedule(serverId, token, {
        intervalMinutes,
        ioThrottleMbps: ioThrottleMbps ? parseInt(ioThrottleMbps, 10) : null,
        windowStart: windowStart || null,
        windowEnd: windowEnd || null,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !schedule) {
    return <div className="flex items-center justify-center py-12 text-text4 text-sm">{t('schedule.loading')}</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-text1">{t('schedule.title')}</h3>
        <p className="text-xs text-text4 mt-0.5">{t('schedule.subtitle')}</p>
      </div>

      {/* Interval */}
      <div className="bg-panel border border-border rounded-xl p-5 space-y-4">
        <div>
          <label className="text-xs text-text3 font-medium block mb-2">{t('schedule.interval')}</label>
          <div className="flex flex-wrap gap-1.5">
            {INTERVAL_PRESETS.map(({ label, value }) => (
              <button
                key={value}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  intervalMinutes === value
                    ? 'bg-accent text-white border-accent font-semibold shadow-sm'
                    : 'bg-white text-text3 border-border hover:bg-surface hover:text-text2'
                }`}
                onClick={() => setIntervalMinutes(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-text4 mt-2">{t('schedule.intervalHint')}</p>
        </div>

        {/* I/O Throttle */}
        <div>
          <label className="text-xs text-text3 font-medium block mb-1.5">{t('schedule.ioThrottle')}</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="input text-sm w-24"
              placeholder="50"
              min="1"
              max="1000"
              value={ioThrottleMbps}
              onChange={(e) => setIoThrottleMbps(e.target.value)}
            />
            <span className="text-xs text-text4">MB/s</span>
          </div>
          <p className="text-[11px] text-text4 mt-1">{t('schedule.ioThrottleHint')}</p>
        </div>

        {/* Backup window */}
        <div>
          <label className="text-xs text-text3 font-medium block mb-1.5">{t('schedule.window')}</label>
          <div className="flex items-center gap-2">
            <input
              type="time"
              className="input text-sm w-32"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
            />
            <span className="text-xs text-text4">{t('schedule.to')}</span>
            <input
              type="time"
              className="input text-sm w-32"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
            />
          </div>
          <p className="text-[11px] text-text4 mt-1">{t('schedule.windowHint')}</p>
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}
        {success && (
          <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {t('schedule.saved')}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button className="btn-primary text-xs py-2 px-5" onClick={save} disabled={saving}>
            {saving ? t('schedule.saving') : t('schedule.save')}
          </button>
          <button className="btn-ghost text-xs py-2 px-4" onClick={load} disabled={loading}>
            {t('schedule.reset')}
          </button>
        </div>
      </div>
    </div>
  );
}
