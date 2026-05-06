import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import ServiceAdminModal from '../auth/ServiceAdminModal.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import LanguageMenu from './LanguageMenu.jsx';

function UserAvatar({ email }) {
  const initial = (email?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accentHover text-[11px] font-bold text-white shadow-sm shadow-accent/30"
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

export default function AppHeader({ onBack, backLabel, children }) {
  const { user, token, isSystemAdmin, logout } = useAuth();
  const { t } = useI18n();
  const [svcModal, setSvcModal] = useState(false);
  const email = user?.email ?? '';

  return (
    <>
      <header className="shrink-0 relative z-20 border-b border-border/80 bg-panel shadow-[0_4px_24px_-8px_rgba(15,24,40,0.12),inset_0_-1px_0_rgba(15,108,189,0.06)]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/35 to-transparent"
          aria-hidden="true"
        />
        <div className="relative flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            {onBack && (
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-surface text-text2 shadow-sm transition hover:border-accent/30 hover:bg-accentLight/50 hover:text-accent"
                onClick={onBack}
                title={backLabel ?? t('header.back')}
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M10 3L5 8l5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}

            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accentHover shadow-md shadow-accent/25 ring-2 ring-white">
                <svg className="h-[18px] w-[18px] text-white" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M2 5a2 2 0 012-2h3l1.5 1.5H12a2 2 0 012 2v5a2 2 0 01-2 2H4a2 2 0 01-2-2V5z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div className="min-w-0 leading-tight">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="truncate text-[15px] font-bold tracking-tight text-text1 sm:text-base">
                    ProperBackup
                  </span>
                  <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-text4 sm:inline">
                    {t('header.panelBadge')}
                  </span>
                </div>
              </div>
            </div>

            {children != null && children !== false && (
              <div className="ml-1 hidden min-w-0 items-center gap-2 border-l border-border/70 pl-3 sm:flex sm:ml-2 sm:pl-4">
                {children}
              </div>
            )}
          </div>

          <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1.5 sm:gap-2">
            {token && isSystemAdmin && (
              <span className="badge hidden border border-amber-200/90 bg-gradient-to-b from-amber-50 to-amber-100/90 px-2.5 py-1 text-[11px] font-semibold text-amber-950 shadow-sm sm:inline-flex">
                {t('header.serviceAdminBadge')}
              </span>
            )}
            {token && !isSystemAdmin && (
              <button
                type="button"
                className="btn-secondary shrink-0 py-1.5 text-xs leading-tight"
                onClick={() => setSvcModal(true)}
                title={t('header.serviceModeTitle')}
              >
                {t('header.serviceMode')}
              </button>
            )}
            {/* Mobile: skrócona ścieżka kontekstu */}
            {children != null && children !== false && (
              <div className="flex max-w-[42vw] items-center gap-1.5 overflow-x-auto sm:hidden">{children}</div>
            )}

            <div className="hidden h-8 w-px bg-border/90 sm:block" aria-hidden="true" />

            <LanguageMenu />

            <div className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-border/70 bg-surface/90 px-2 py-1 shadow-sm sm:max-w-[min(100%,28rem)]">
              <UserAvatar email={email} />
              <span className="min-w-0 flex-1 text-xs font-medium leading-snug text-text2 break-all sm:break-words">
                {email || t('header.userPlaceholder')}
              </span>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-panel px-2.5 py-1.5 text-xs font-semibold text-text2 shadow-sm transition hover:border-danger/25 hover:bg-dangerLight/60 hover:text-danger sm:px-3"
              onClick={logout}
            >
              <svg
                className="h-3.5 w-3.5 shrink-0 opacity-75"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hidden sm:inline">{t('header.logout')}</span>
            </button>
          </div>
        </div>
      </header>
      <ServiceAdminModal open={svcModal} onClose={() => setSvcModal(false)} />
    </>
  );
}
