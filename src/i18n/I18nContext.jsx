import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import pl from './locales/pl.json';
import en from './locales/en.json';

const STORAGE_KEY = 'properbackup.locale';

const bundles = { pl, en };

const BCP47 = { pl: 'pl-PL', en: 'en-US' };

function detectLocale() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === 'pl' || s === 'en') return s;
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en';
  return String(nav).toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

function interpolate(str, vars = {}) {
  return String(str).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    vars[k] != null && vars[k] !== '' ? String(vars[k]) : '',
  );
}

function getNested(obj, path) {
  return path.split('.').reduce((o, k) => (o != null && typeof o === 'object' ? o[k] : undefined), obj);
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLocale);

  const fallback = bundles.en;

  const t = useCallback(
    (key, vars) => {
      const cur = bundles[locale] ?? fallback;
      let s = getNested(cur, key) ?? getNested(fallback, key) ?? key;
      if (typeof s !== 'string') return key;
      return interpolate(s, vars && typeof vars === 'object' ? vars : {});
    },
    [locale],
  );

  const bcp47 = BCP47[locale] ?? BCP47.en;

  const formatDateTime = useCallback(
    (iso, options) => {
      if (!iso) {
        const cur = bundles[locale] ?? fallback;
        return getNested(cur, 'common.dash') ?? '—';
      }
      try {
        return new Date(iso).toLocaleString(bcp47, options ?? { dateStyle: 'medium', timeStyle: 'short' });
      } catch {
        return String(iso);
      }
    },
    [bcp47, locale, fallback],
  );

  const setLocale = useCallback((next) => {
    const v = next === 'pl' || next === 'en' ? next : 'en';
    setLocaleState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = v === 'pl' ? 'pl' : 'en';
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'pl' ? 'pl' : 'en';
    }
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      locales: [
        { id: 'pl', labelNative: bundles.pl.lang.pl, labelEn: 'Polish' },
        { id: 'en', labelNative: bundles.en.lang.en, labelEn: 'English' },
      ],
      t,
      formatDateTime,
      bcp47,
    }),
    [locale, setLocale, t, formatDateTime, bcp47],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
