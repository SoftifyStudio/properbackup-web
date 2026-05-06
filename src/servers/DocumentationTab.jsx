import React, { useMemo, useState } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

const DOC_ITEMS = [
  {
    id: 'getting-started',
    titleKey: 'backups.docsGettingStartedTitle',
    bodyKey: 'backups.docsGettingStartedBody',
  },
  {
    id: 'agent-status',
    titleKey: 'backups.docsAgentStatusTitle',
    bodyKey: 'backups.docsAgentStatusBody',
  },
  {
    id: 'troubleshooting',
    titleKey: 'backups.docsTroubleshootingTitle',
    bodyKey: 'backups.docsTroubleshootingBody',
  },
];

export default function DocumentationTab() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(DOC_ITEMS[0].id);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOC_ITEMS;
    return DOC_ITEMS.filter((item) => {
      const title = t(item.titleKey).toLowerCase();
      const body = t(item.bodyKey).toLowerCase();
      return title.includes(q) || body.includes(q);
    });
  }, [query, t]);

  const active = filteredItems.find((i) => i.id === activeId) ?? filteredItems[0] ?? null;

  return (
    <section className="rounded-xl2 border border-border bg-panel overflow-hidden shadow-card min-h-[22rem]">
      <div className="grid md:grid-cols-[15rem_1fr]">
        <aside className="border-b md:border-b-0 md:border-r border-border bg-surface/70 p-3 space-y-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input text-sm"
            placeholder={t('backups.docsSearchPlaceholder')}
          />
          <nav className="space-y-1">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                  active?.id === item.id ? 'bg-accentLight text-accent font-semibold' : 'text-text2 hover:bg-panel'
                }`}
              >
                {t(item.titleKey)}
              </button>
            ))}
            {filteredItems.length === 0 && (
              <p className="text-xs text-text4 px-2 py-3">{t('backups.docsNoResults')}</p>
            )}
          </nav>
        </aside>
        <div className="p-5 sm:p-6">
          {active ? (
            <>
              <h2 className="text-xl font-semibold text-text1">{t(active.titleKey)}</h2>
              <p className="mt-3 text-sm leading-relaxed text-text2 whitespace-pre-line">{t(active.bodyKey)}</p>
            </>
          ) : (
            <p className="text-sm text-text4">{t('backups.docsSelectHint')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
