import React, { useId } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

/**
 * Accessible language switcher styled as a dropdown (native select skin).
 */
export default function LanguageMenu({ className = '' }) {
  const { locale, setLocale, locales, t } = useI18n();
  const id = useId();

  return (
    <div className={`relative flex items-center shrink-0 ${className}`}>
      <label htmlFor={id} className="sr-only">
        {t('lang.label')}
      </label>
      <div className="pointer-events-none absolute right-3 top-1/2 z-[1] -translate-y-1/2 text-text3">
        <svg className="h-4 w-4 opacity-75" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <select
        id={id}
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        aria-label={t('lang.label')}
        className="appearance-none cursor-pointer rounded-xl border border-border/80 bg-panel py-2 pl-3 pr-9 text-xs font-semibold text-text2 shadow-sm transition hover:border-accent/35 hover:bg-accentLight/35 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/40 sm:text-[13px] min-w-[7.75rem]"
      >
        {locales.map(({ id: locId }) => (
          <option key={locId} value={locId}>
            {locId === 'pl' ? t('lang.pl') : t('lang.en')}
          </option>
        ))}
      </select>
    </div>
  );
}
