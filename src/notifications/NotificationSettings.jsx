import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';

const BASE_URL = bufferBaseUrl();

export default function NotificationSettings() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [settings, setSettings] = useState({
    enabled: false,
    email: '',
    onAgentOffline: true,
    onStorageWarning: true,
    onSubscriptionExpiry: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/account/notification-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch {
      // endpoint may not exist yet — use defaults
    }
  }, [token]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveSettings = useCallback(async () => {
    if (!token) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/account/notification-settings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [token, settings]);

  const update = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  return (
    <div className="rounded-xl border border-border bg-panel p-6 shadow-card space-y-5">
      <h2 className="text-lg font-bold text-text1">{t('notifications.title')}</h2>

      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm font-medium text-text1">{t('notifications.enableNotifications')}</p>
          <p className="text-xs text-text4 mt-0.5">{t('notifications.enableDesc')}</p>
        </div>
        <button
          className={`relative w-11 h-6 rounded-full transition-colors ${settings.enabled ? 'bg-accent' : 'bg-gray-300'}`}
          onClick={() => update('enabled', !settings.enabled)}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            settings.enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      {settings.enabled && (
        <>
          <div>
            <label className="text-sm font-medium text-text2 block mb-1">
              {t('notifications.emailAddress')}
            </label>
            <input
              type="email"
              className="input w-full max-w-sm"
              placeholder="email@example.com"
              value={settings.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold text-text3 uppercase tracking-wide">
              {t('notifications.alertTypes')}
            </p>

            {[
              { key: 'onAgentOffline', label: t('notifications.alertAgentOffline'), desc: t('notifications.alertAgentOfflineDesc') },
              { key: 'onStorageWarning', label: t('notifications.alertStorageWarning'), desc: t('notifications.alertStorageWarningDesc') },
              { key: 'onSubscriptionExpiry', label: t('notifications.alertSubscriptionExpiry'), desc: t('notifications.alertSubscriptionExpiryDesc') },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-sm text-text1">{label}</p>
                  <p className="text-xs text-text4">{desc}</p>
                </div>
                <button
                  className={`relative w-9 h-5 rounded-full transition-colors ${settings[key] ? 'bg-accent' : 'bg-gray-300'}`}
                  onClick={() => update(key, !settings[key])}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    settings[key] ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-text4 italic">
            {t('notifications.smsNote')}
          </p>
        </>
      )}

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          className="px-5 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? t('notifications.saving') : t('notifications.save')}
        </button>
        {saved && (
          <span className="text-xs text-emerald-600 font-medium">{t('notifications.saved')}</span>
        )}
      </div>
    </div>
  );
}
