import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import AppHeader from '../layout/AppHeader.jsx';
import AdminModeBar from '../layout/AdminModeBar.jsx';
import ServerCard from './ServerCard.jsx';
import AddServerModal from './AddServerModal.jsx';
import OnboardingWizard from '../onboarding/OnboardingWizard.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { boldPartsReact } from '../i18n/bold.jsx';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PaymentGateBanner, { usePaymentGate } from '../subscription/PaymentGateBanner.jsx';

import { bufferBaseUrl } from '../bufferConfig.js';

const BASE_URL = bufferBaseUrl();

function PanelTabStrip({ value, onChange }) {
  const { t } = useI18n();
  const tab = (id, labelKey) => (
    <button
      key={id}
      type="button"
      onClick={() => onChange(id)}
      className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
        value === id
          ? 'bg-panel text-text1 shadow-sm ring-1 ring-accent/35'
          : 'text-text3 hover:bg-panel/60 hover:text-text1'
      }`}
      aria-pressed={value === id}
    >
      {t(labelKey)}
    </button>
  );
  return (
    <nav
      className="flex items-stretch gap-0.5 rounded-lg bg-surface/90 p-0.5 shadow-inner ring-1 ring-border/80"
      aria-label={t('serversPage.navAria')}
    >
      {tab('servers', 'serversPage.tabServers')}
      {tab('tokens', 'serversPage.tabTokens')}
    </nav>
  );
}

export default function ServersPage({ onSelectServer }) {
  const { token, isSystemAdmin } = useAuth();
  const { t, formatDateTime } = useI18n();
  const navigate = useNavigate();
  const gated = usePaymentGate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const mainTab = urlTab === 'tokens' ? 'tokens' : 'servers';
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tokens, setTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokensError, setTokensError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [quota, setQuota] = useState(null);

  const setMainTab = useCallback((nextTab) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('tab', nextTab);
      return p;
    }, { replace: true });
  }, [setSearchParams]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/servers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setServers(await res.json());
    } catch (e) {
      setError(t('serversPage.loadError', { message: e.message }));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  const loadQuota = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/account/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setQuota(await res.json());
    } catch (_) { /* non-critical */ }
  }, [token]);

  const loadTokens = useCallback(async () => {
    if (!token) return;
    setTokensLoading(true);
    setTokensError('');
    try {
      const res = await fetch(`${BASE_URL}/servers/activation-tokens`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTokens(await res.json());
    } catch (e) {
      setTokensError(t('serversPage.tokensLoadError', { message: e.message }));
    } finally {
      setTokensLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    load();
    loadQuota();
  }, [load, loadQuota]);

  useEffect(() => {
    if (mainTab === 'tokens') loadTokens();
  }, [mainTab, loadTokens]);

  const refreshAll = () => {
    load();
    loadTokens();
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface overflow-hidden">
      <AppHeader>
        <PanelTabStrip value={mainTab} onChange={setMainTab} />
      </AppHeader>
      {isSystemAdmin && <AdminModeBar variant="list" />}

      <main
        className={
          mainTab === 'servers'
            ? 'flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 sm:px-10 py-8 w-full max-w-[min(100%,88rem)] mx-auto'
            : 'flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-8 max-w-3xl w-full mx-auto'
        }
      >
        {mainTab === 'servers' && (
          <>
            <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
              <div>
                <h1 className="text-text1 font-bold text-2xl tracking-tight">
                  {isSystemAdmin ? t('serversPage.titleAll') : t('serversPage.titleYours')}
                </h1>
                <p className="text-text3 text-base mt-1.5 max-w-2xl">
                  {isSystemAdmin ? t('serversPage.subtitleAdmin') : t('serversPage.subtitleUser')}
                </p>
              </div>
              <button
                className="btn-primary text-sm"
                onClick={() => setShowAdd(true)}
                disabled={gated}
                title={gated ? t('paymentGate.blocked') : undefined}
              >
                {t('serversPage.addServer')}
              </button>
            </div>

            {loading && (
              <div className="flex items-center gap-3 text-text3 text-sm py-8 justify-center">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                {t('serversPage.loadingServers')}
              </div>
            )}

            {!loading && error && (
              <div className="bg-dangerLight border border-danger/20 rounded-xl2 p-4 text-danger text-sm">{error}</div>
            )}

            {gated && (
              <div className="mb-6">
                <PaymentGateBanner onGoToSubscription={() => navigate('/account/subscription')} />
              </div>
            )}

            {!loading && !error && servers.length === 0 && !gated && (
              <OnboardingWizard onComplete={() => { load(); loadQuota(); }} />
            )}

            {!loading && !error && servers.length === 0 && gated && (
              <div className="rounded-xl2 border border-border bg-panel p-8 text-center text-text3 text-sm">
                {t('serversPage.emptyTitle')}
              </div>
            )}

            {!loading && quota && quota.storageUsedBytes != null && servers.length > 0 && (
              <div className="mb-6 rounded-xl bg-panel border border-border p-4">
                <div className="flex items-center justify-between text-xs text-text3 mb-1.5">
                  <span className="font-medium">
                    {t('subscription.storageUsed')} — {servers.length} {servers.length === 1 ? t('serversPage.device') : t('serversPage.devices')}
                  </span>
                  <span className={quota.storageExceeded ? 'text-red-600 font-semibold' : ''}>
                    {quota.storageUsedLabel} / {quota.storageLimitLabel}
                    {' '}({(quota.storageUsedPercent || 0).toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      quota.storageExceeded ? 'bg-red-500' :
                      (quota.storageUsedPercent || 0) > 80 ? 'bg-amber-500' :
                      'bg-accent'
                    }`}
                    style={{ width: `${Math.min(100, quota.storageUsedPercent || 0)}%` }}
                  />
                </div>
                {quota.storageExceeded && (
                  <p className="text-xs text-red-600 mt-1.5 font-medium">
                    {t('subscription.storageExceeded')}
                  </p>
                )}
              </div>
            )}

            {!loading && !error && servers.length > 0 && (
              <ul className="flex flex-col gap-3 min-h-0" role="list">
                {servers.map(server => (
                  <li key={server.id} className="min-w-0">
                    <ServerCard
                      server={server}
                      showOwner={isSystemAdmin}
                      onClick={() => onSelectServer(server)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {mainTab === 'tokens' && (
          <>
            {gated && (
              <div className="mb-6">
                <PaymentGateBanner onGoToSubscription={() => navigate('/account/subscription')} />
              </div>
            )}
            <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
              <div>
                <h1 className="text-text1 font-bold text-lg">{t('serversPage.tokensTitle')}</h1>
                <p className="text-text3 text-sm mt-0.5">{t('serversPage.tokensSubtitle')}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" className="btn-ghost text-sm" onClick={() => loadTokens()} disabled={tokensLoading}>
                  {t('serversPage.refresh')}
                </button>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={() => setShowAdd(true)}
                  disabled={gated}
                  title={gated ? t('paymentGate.blocked') : undefined}
                >
                  {t('serversPage.newToken')}
                </button>
              </div>
            </div>

            {tokensLoading && (
              <div className="flex items-center gap-3 text-text3 text-sm py-8 justify-center">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                {t('serversPage.loadingTokens')}
              </div>
            )}

            {!tokensLoading && tokensError && (
              <div className="bg-dangerLight border border-danger/20 rounded-xl2 p-4 text-danger text-sm">{tokensError}</div>
            )}

            {!tokensLoading && !tokensError && tokens.length === 0 && (
              <div className="rounded-xl2 border border-border bg-panel p-8 text-center text-text3 text-sm">
                {boldPartsReact(t('serversPage.tokensEmptyRich'))}
              </div>
            )}

            {!tokensLoading && !tokensError && tokens.length > 0 && (
              <div className="overflow-x-auto rounded-xl2 border border-border bg-panel shadow-card">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface text-text3 text-xs uppercase tracking-wide border-b border-border">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{t('serversPage.colKey')}</th>
                      {isSystemAdmin && <th className="px-4 py-3 font-semibold">{t('serversPage.colAccount')}</th>}
                      <th className="px-4 py-3 font-semibold">{t('serversPage.colCreated')}</th>
                      <th className="px-4 py-3 font-semibold">{t('serversPage.colExpires')}</th>
                      <th className="px-4 py-3 font-semibold w-28"> </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tokens.map(row => (
                      <tr key={row.token} className="text-text2 hover:bg-surface/80">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-text1">{row.token}</td>
                        {isSystemAdmin && (
                          <td className="px-4 py-3 text-xs break-all max-w-[10rem]">{row.ownerEmail}</td>
                        )}
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {formatDateTime(row.createdAt, { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {formatDateTime(row.expiresAt, { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="btn-ghost text-xs py-1"
                            onClick={() => navigator.clipboard.writeText(row.token)}
                          >
                            {t('serversPage.copyKey')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {showAdd && (
        <AddServerModal
          onClose={() => setShowAdd(false)}
          onAdded={refreshAll}
        />
      )}
    </div>
  );
}
