import React from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function ServerCard({ server, showOwner, onClick }) {
  const { t, formatDateTime } = useI18n();
  const lastSeenLabel = t('serverCard.lastActivityLabel');
  const lastSeen = server.lastSeen
    ? formatDateTime(server.lastSeen, { dateStyle: 'medium', timeStyle: 'short' })
    : t('common.dash');

  return (
    <button
      type="button"
      className="group w-full text-left bg-panel rounded-xl2 shadow-card border border-border transition-all hover:shadow-lg hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 min-h-[7.5rem] px-6 py-5 sm:px-8 sm:py-6"
      onClick={onClick}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="flex items-start gap-4 sm:gap-5 min-w-0 flex-1">
          <div className="w-14 h-14 rounded-xl2 bg-accentLight flex items-center justify-center shrink-0 shadow-inner">
            <svg className="w-7 h-7 text-accent" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm14 1a1 1 0 11-2 0 1 1 0 012 0zM2 13a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2zm14 1a1 1 0 11-2 0 1 1 0 012 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-text1 font-semibold text-lg sm:text-xl leading-snug truncate" title={server.name}>
              {server.name}
            </p>
            <p className="text-text3 text-xs font-medium uppercase tracking-wide">{t('serverCard.identifier')}</p>
            <p className="text-text2 font-mono text-sm sm:text-base break-all leading-relaxed">{server.id}</p>
            {showOwner && server.ownerEmail && (
              <p className="text-text3 text-sm pt-1">
                {t('serverCard.owner')}{' '}
                <span className="font-mono text-text2">{server.ownerEmail}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 border-t border-border pt-4 sm:border-t-0 sm:pt-0 sm:pl-6 sm:border-l sm:border-border">
          <div
            className="flex items-center gap-2 text-text3 text-sm sm:text-right"
            title={t('serverCard.lastActivityHint')}
          >
            <svg className="w-4 h-4 shrink-0 opacity-80" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 4.5v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <div>
              <p className="text-text4 text-[11px] uppercase tracking-wide font-medium leading-snug max-w-[12rem] sm:max-w-[14rem]">
                {lastSeenLabel}
              </p>
              <p className="text-text2 font-medium tabular-nums">{lastSeen}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-accent text-sm font-semibold group-hover:gap-2 transition-all">
            {t('serverCard.open')}
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </button>
  );
}
