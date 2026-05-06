import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

/**
 * UI for OVH Cloud Archive thaw wait. mockMode: ~5s instead of hours.
 */
export default function ThawProgress({ onReady, mockMode = true }) {
  const { t } = useI18n();
  const TOTAL_MS = mockMode ? 5_000 : 4 * 60 * 60 * 1000;
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const e = Date.now() - start;
      setElapsed(e);
      if (e >= TOTAL_MS) {
        clearInterval(interval);
        setDone(true);
        onReady?.();
      }
    }, mockMode ? 100 : 10_000);
    return () => clearInterval(interval);
    // intentional: thaw timer runs once per mount (wizard step holds stable callback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.min(100, Math.round((elapsed / TOTAL_MS) * 100));

  const formatRemaining = () => {
    const rem = Math.max(0, TOTAL_MS - elapsed);
    if (mockMode) {
      return t('recovery.thaw.mockSeconds', { seconds: (rem / 1000).toFixed(1) });
    }
    const h = Math.floor(rem / 3_600_000);
    const m = Math.floor((rem % 3_600_000) / 60_000);
    return `${h}h ${m}min`;
  };

  if (done) {
    return (
      <div className="bg-successLight border border-success/25 rounded-xl2 p-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-success shrink-0" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-success text-sm font-semibold">{t('recovery.thaw.ready')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-warnLight border border-warn/25 rounded-xl2 p-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3.5 h-3.5 border-2 border-warn border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-warn text-sm font-semibold">{t('recovery.thaw.inProgressTitle')}</p>
        </div>
        <p className="text-text2 text-sm">
          {t('recovery.thaw.tapeExplain')}
          {mockMode ? t('recovery.thaw.mockMode') : t('recovery.thaw.prodEta')}
        </p>
      </div>

      <div>
        <div className="flex justify-between text-xs text-text3 mb-1">
          <span>{t('recovery.thaw.progressLabel')}</span>
          <span>{t('recovery.thaw.remaining', { time: formatRemaining() })}</span>
        </div>
        <div className="h-2 bg-surface rounded-full overflow-hidden border border-border">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-text4 mt-1 text-right">{pct}%</p>
      </div>
    </div>
  );
}
