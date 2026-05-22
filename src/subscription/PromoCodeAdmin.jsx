import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import AppHeader from '../layout/AppHeader.jsx';
import { fetchPromoCodes, createPromoCode, deactivatePromoCode } from '../api/bufferClient.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const PROMO_TYPES = [
  { value: 'percentage', label: 'promoAdmin.typePercentage' },
  { value: 'fixed', label: 'promoAdmin.typeFixed' },
  { value: 'one_time', label: 'promoAdmin.typeOneTime' },
  { value: 'first_order', label: 'promoAdmin.typeFirstOrder' },
];

export default function PromoCodeAdmin({ onBack }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    code: '',
    type: 'percentage',
    discountPercent: '',
    discountGrosze: '',
    applicablePlan: '',
    maxUses: '1',
    expiresAt: '',
  });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchPromoCodes(token);
      setCodes(data.promoCodes || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        maxUses: parseInt(form.maxUses, 10) || 1,
      };
      if (form.discountPercent) payload.discountPercent = parseInt(form.discountPercent, 10);
      if (form.discountGrosze) payload.discountGrosze = parseInt(form.discountGrosze, 10);
      if (form.applicablePlan) payload.applicablePlan = form.applicablePlan;
      if (form.expiresAt) payload.expiresAt = new Date(form.expiresAt).toISOString();
      await createPromoCode(payload, token);
      setForm({ code: '', type: 'percentage', discountPercent: '', discountGrosze: '', applicablePlan: '', maxUses: '1', expiresAt: '' });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await deactivatePromoCode(id, token);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface overflow-hidden">
      <AppHeader onBack={onBack} backLabel={t('promoAdmin.back')}>
        <span className="text-sm font-semibold text-text1">{t('promoAdmin.title')}</span>
      </AppHeader>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-8 max-w-4xl w-full mx-auto">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-6">{error}</div>
        )}

        {/* Create form */}
        <div className="rounded-xl border border-border bg-panel p-6 shadow-card mb-8">
          <h2 className="text-lg font-bold text-text1 mb-4">{t('promoAdmin.createTitle')}</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs text-text3 uppercase tracking-wide">{t('promoAdmin.code')}</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="PROMO-50"
                required
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text1 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs text-text3 uppercase tracking-wide">{t('promoAdmin.type')}</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text1 focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                {PROMO_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{t(label)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text3 uppercase tracking-wide">{t('promoAdmin.discountPercent')}</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.discountPercent}
                onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                placeholder="50"
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text1 focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div>
              <label className="text-xs text-text3 uppercase tracking-wide">{t('promoAdmin.discountGrosze')}</label>
              <input
                type="number"
                min="0"
                value={form.discountGrosze}
                onChange={(e) => setForm({ ...form, discountGrosze: e.target.value })}
                placeholder="500"
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text1 focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div>
              <label className="text-xs text-text3 uppercase tracking-wide">{t('promoAdmin.applicablePlan')}</label>
              <select
                value={form.applicablePlan}
                onChange={(e) => setForm({ ...form, applicablePlan: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text1 focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                <option value="">{t('promoAdmin.allPlans')}</option>
                <option value="monthly">{t('promoAdmin.monthly')}</option>
                <option value="annual">{t('promoAdmin.annual')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text3 uppercase tracking-wide">{t('promoAdmin.maxUses')}</label>
              <input
                type="number"
                min="1"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text1 focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs text-text3 uppercase tracking-wide">{t('promoAdmin.expiresAt')}</label>
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text1 focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <div className="col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={creating || !form.code.trim()}
                className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {creating ? t('promoAdmin.creating') : t('promoAdmin.create')}
              </button>
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-panel shadow-card overflow-hidden">
          <h2 className="text-lg font-bold text-text1 p-6 pb-4">{t('promoAdmin.listTitle')}</h2>
          {loading ? (
            <div className="flex items-center gap-3 text-text3 text-sm py-8 justify-center">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-border bg-surface/50">
                    <th className="text-left px-4 py-2 text-text3 text-xs font-medium uppercase">{t('promoAdmin.code')}</th>
                    <th className="text-left px-4 py-2 text-text3 text-xs font-medium uppercase">{t('promoAdmin.type')}</th>
                    <th className="text-left px-4 py-2 text-text3 text-xs font-medium uppercase">{t('promoAdmin.discount')}</th>
                    <th className="text-center px-4 py-2 text-text3 text-xs font-medium uppercase">{t('promoAdmin.usage')}</th>
                    <th className="text-center px-4 py-2 text-text3 text-xs font-medium uppercase">{t('promoAdmin.status')}</th>
                    <th className="text-right px-4 py-2 text-text3 text-xs font-medium uppercase">{t('promoAdmin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.id} className="border-t border-border hover:bg-surface/30">
                      <td className="px-4 py-3 font-mono text-text1">{c.code}</td>
                      <td className="px-4 py-3 text-text2">{c.type}</td>
                      <td className="px-4 py-3 text-text2">
                        {c.discountPercent ? `${c.discountPercent}%` : c.discountGrosze ? `${(c.discountGrosze / 100).toFixed(2)} PLN` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-text2">{c.usedCount} / {c.maxUses}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${c.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {c.active ? t('promoAdmin.active') : t('promoAdmin.inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.active && (
                          <button
                            onClick={() => handleDeactivate(c.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            {t('promoAdmin.deactivate')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {codes.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-text3 text-sm">{t('promoAdmin.empty')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
