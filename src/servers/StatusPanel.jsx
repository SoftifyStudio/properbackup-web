import React, { useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

function isOnline(lastSeen) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS;
}

function StatusDot({ online }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
        online ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,.45)]' : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,.35)]'
      }`}
    />
  );
}

export default function StatusPanel({ servers, loading }) {
  const { t, formatDateTime } = useI18n();

  const sorted = useMemo(() => {
    if (!servers) return [];
    return [...servers].sort((a, b) => {
      const aOn = isOnline(a.lastSeen);
      const bOn = isOnline(b.lastSeen);
      if (aOn !== bOn) return aOn ? 1 : -1;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [servers]);

  const offlineCount = useMemo(
    () => sorted.filter((s) => !isOnline(s.lastSeen)).length,
    [sorted],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-text3 text-sm py-8 justify-center">
        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        {t('serversPage.loadingServers')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-text1 font-bold text-lg">{t('serversPage.statusTitle')}</h1>
        <p className="text-text3 text-sm mt-0.5">{t('serversPage.statusSubtitle')}</p>
      </div>

      {sorted.length > 0 && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center gap-2.5 ${
            offlineCount === 0
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-500/10 border-red-500/25 text-red-700 dark:text-red-400'
          }`}
        >
          <StatusDot online={offlineCount === 0} />
          {offlineCount === 0
            ? t('serversPage.statusAllOnline')
            : t('serversPage.statusSomeOffline', { count: offlineCount })}
        </div>
      )}

      {sorted.length === 0 && (
        <p className="text-text3 text-sm py-4">{t('serversPage.emptyTitle')}</p>
      )}

      <div className="space-y-2">
        {sorted.map((server) => {
          const online = isOnline(server.lastSeen);
          const lastSeenFmt = server.lastSeen
            ? formatDateTime(server.lastSeen, { dateStyle: 'medium', timeStyle: 'short' })
            : t('serversPage.statusNeverSeen');

          return (
            <div
              key={server.id}
              className="flex items-center gap-4 rounded-xl bg-panel border border-border px-5 py-4 transition hover:border-accent/30"
            >
              <StatusDot online={online} />
              <div className="flex-1 min-w-0">
                <p className="text-text1 font-semibold text-sm truncate">{server.name}</p>
                <p className="text-text3 text-xs font-mono truncate">{server.id}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xs font-semibold ${online ? 'text-emerald-600' : 'text-red-500'}`}>
                  {online ? t('serversPage.statusOnline') : t('serversPage.statusOffline')}
                </p>
                <p className="text-text4 text-xs mt-0.5">
                  {t('serversPage.statusLastSeen')}: {lastSeenFmt}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
