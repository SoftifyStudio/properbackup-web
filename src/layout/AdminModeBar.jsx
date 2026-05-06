import React from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { boldPartsReact } from '../i18n/bold.jsx';

/** Banner for Service Administrator mode (after entering key or account flag). */
export default function AdminModeBar({ variant = 'list', server }) {
  const { t } = useI18n();

  if (variant === 'server' && server) {
    const sid = server.id ?? '';
    return (
      <div className="shrink-0 bg-amber-950/90 text-amber-100 border-b border-amber-800/80 px-6 py-2.5 text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold tracking-wide uppercase text-[10px] text-amber-400/95">
          {t('adminBar.role')}
        </span>
        <span className="text-amber-100/95 break-words">
          {t('adminBar.serverYouView')} <strong className="text-white">{server.name}</strong>
          {server.ownerEmail && (
            <>
              {' · '}
              {t('adminBar.serverAccount')}{' '}
              <span className="font-mono text-amber-50/90">{server.ownerEmail}</span>
            </>
          )}
          {' · '}
          <span className="font-mono text-amber-200/80 break-all">{sid}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="shrink-0 bg-amber-950/90 text-amber-100 border-b border-amber-800/80 px-6 py-2 text-xs">
      <span className="font-semibold tracking-wide uppercase text-[10px] text-amber-400/95 mr-2">
        {t('adminBar.role')}
      </span>
      <span>{boldPartsReact(t('adminBar.listBannerPlain'))}</span>
    </div>
  );
}
