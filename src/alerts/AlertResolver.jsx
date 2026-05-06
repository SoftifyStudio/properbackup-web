import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { boldPartsReact } from '../i18n/bold.jsx';

export default function AlertResolver({ alert, onResolved, onClose }) {
  const { t } = useI18n();
  const [action, setAction] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!alert) return null;

  const resolve = (type) => {
    setAction(type);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onResolved?.({ alertId: alert.id, action: type });
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-panel rounded-xl2 shadow-modal w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-dangerLight flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-danger" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="10.5" r="0.75" fill="currentColor"/>
              </svg>
            </div>
            <h2 className="text-text1 font-bold text-base">{t('alerts.title')}</h2>
          </div>
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text3 hover:bg-surface hover:text-text1 transition-colors"
            onClick={onClose}
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="bg-dangerLight border border-danger/20 rounded-xl2 p-4 mb-4">
          <p className="text-danger text-sm font-semibold mb-1">
            {t('alerts.service')} <span className="font-mono">{alert.service}</span>
          </p>
          <p className="text-text2 text-sm">
            {t('alerts.patternsLead')}{' '}
            <span className="text-warn font-mono text-xs">{alert.patterns.join(', ')}</span>
          </p>
        </div>

        <div className="mb-5">
          <p className="text-text3 text-xs font-semibold uppercase tracking-widest mb-2">{t('alerts.flaggedFiles')}</p>
          <div className="bg-surface border border-border rounded-xl2 p-3 space-y-1 max-h-36 overflow-y-auto">
            {alert.files.map(f => (
              <div key={f} className="flex items-center gap-2 text-xs font-mono">
                <svg className="w-3 h-3 text-danger shrink-0" viewBox="0 0 12 12" fill="currentColor">
                  <circle cx="6" cy="6" r="6"/>
                  <path d="M4 4l4 4M8 4l-4 4" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span className="text-text2">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {!action ? (
          <div className="space-y-2.5">
            <button
              type="button"
              className="w-full text-left bg-surface hover:bg-accentLight border border-border hover:border-accent/30 rounded-xl2 p-3.5 transition-colors group"
              onClick={() => resolve('skip-once')}
            >
              <p className="text-text1 text-sm font-semibold group-hover:text-accent transition-colors">
                {t('alerts.skipOnceTitle')}
              </p>
              <p className="text-text3 text-xs mt-0.5">{t('alerts.skipOnceBody')}</p>
            </button>
            <button
              type="button"
              className="w-full text-left bg-surface hover:bg-accentLight border border-border hover:border-accent/30 rounded-xl2 p-3.5 transition-colors group"
              onClick={() => resolve('add-exclude')}
            >
              <p className="text-text1 text-sm font-semibold group-hover:text-accent transition-colors">
                {t('alerts.excludeTitle')}
              </p>
              <p className="text-text3 text-xs mt-0.5">
                {boldPartsReact(t('alerts.excludeBody', { service: alert.service }))}
              </p>
            </button>
            <button type="button" className="btn-ghost w-full" onClick={onClose}>
              {t('alerts.cancelPaused')}
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-3 text-text3 text-sm py-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
            {action === 'skip-once' ? t('alerts.loadingSkip') : t('alerts.loadingExclude')}
          </div>
        ) : (
          <div className="bg-successLight border border-success/25 rounded-xl2 p-4">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-success" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-success text-sm font-semibold">
                {action === 'skip-once' ? t('alerts.okSkip') : t('alerts.okExclude')}
              </p>
            </div>
            <p className="text-text2 text-xs">{t('alerts.okFooter')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
