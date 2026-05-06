import React, { useMemo, useState } from 'react';
import { groupByRoot } from './TreeBuilder.js';
import { useI18n } from '../i18n/I18nContext.jsx';

function useTsFormat() {
  const { formatDateTime, t } = useI18n();
  return (date) => {
    if (!date) return t('common.dash');
    try {
      const iso = typeof date?.toISOString === 'function' ? date.toISOString() : new Date(date).toISOString();
      return formatDateTime(iso, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return t('common.dash');
    }
  };
}

function SnapshotRow({ snap, onRestore }) {
  const { t } = useI18n();
  const fmt = useTsFormat();
  const isActive = snap.flag === 'A';
  return (
    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-accentLight rounded-lg group transition-colors cursor-default">
      <div className="flex items-center gap-3">
        <span className={`badge ${isActive ? 'bg-successLight text-success' : 'bg-dangerLight text-danger'}`}>
          {isActive ? t('tree.snapshotActive') : t('tree.snapshotRemoved')}
        </span>
        <span className="text-text2 text-sm">{fmt(snap.timestamp)}</span>
        <span className="text-text4 text-xs font-mono">{snap.shortHash}</span>
      </div>
      {isActive && (
        <button
          className="opacity-0 group-hover:opacity-100 btn-primary py-1 px-3 text-xs transition-opacity"
          type="button"
          onClick={() => onRestore(snap)}
        >
          {t('tree.restore')}
        </button>
      )}
    </div>
  );
}

function PathCard({ node, onRestore }) {
  const { t } = useI18n();
  const fmt = useTsFormat();
  const [open, setOpen] = useState(false);

  const displayPath = node.isOrphan
    ? `${t('tree.unknownPathPrefix')} ${node.pathId}`
    : node.fullPath;

  const latest = node.snapshots.at(-1);
  const count = node.snapshots.length;
  const snapWord = count === 1 ? t('tree.snapshotSingular') : t('tree.snapshotPlural');

  return (
    <div className={`card mb-2 overflow-hidden transition-shadow hover:shadow-cardHover ${node.isOrphan ? 'border-l-4 border-l-warn' : ''}`}>
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <svg
          className={`w-4 h-4 text-text4 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        <svg className={`w-5 h-5 shrink-0 ${node.isOrphan ? 'text-warn' : node.isDeleted ? 'text-text4' : 'text-accent'}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
        </svg>

        <span className={`flex-1 text-sm font-medium ${node.isDeleted ? 'line-through text-text4' : node.isOrphan ? 'text-warn' : 'text-text1'}`}>
          {displayPath}
        </span>

        <div className="flex items-center gap-2 shrink-0">
          {node.isOrphan && <span className="badge bg-warnLight text-warn">{t('tree.badgeOrphan')}</span>}
          {node.isDeleted && !node.isOrphan && (
            <span className="badge bg-dangerLight text-danger">{t('tree.badgeDeleted')}</span>
          )}
          <span className="text-text4 text-xs">
            {count} {snapWord}
          </span>
          <span className="text-text4 text-xs">{fmt(latest?.timestamp)}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-2 py-2 bg-surface/40">
          {node.snapshots.slice().reverse().map(snap => (
            <SnapshotRow key={snap.raw} snap={snap} onRestore={(s) => onRestore(s, node)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RootSection({ rootKey, nodes, onRestore, meta, defaultOpen }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const isOrphanGroup = rootKey === '__orphans__';
  const totalSnaps = nodes.reduce((s, n) => s + n.snapshots.length, 0);

  return (
    <section className="mb-8">
      <button
        type="button"
        className="flex items-center gap-2.5 mb-3 group w-full text-left"
        onClick={() => setOpen(o => !o)}
      >
        <svg
          className={`w-4 h-4 text-text4 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-base">{meta.icon}</span>
        <h2 className={`text-sm font-semibold uppercase tracking-wider ${isOrphanGroup ? 'text-warn' : 'text-text2'}`}>
          {meta.label}
        </h2>
        <span className="text-text4 text-xs ml-1">
          {t('tree.sectionCounts', { pathCount: nodes.length, snapCount: totalSnaps })}
        </span>
      </button>

      {open && (
        <div className="pl-6">
          {nodes.map(node => (
            <PathCard key={node.pathId} node={node} onRestore={onRestore} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function DirectoryView({ nodes, onRestore }) {
  const { t } = useI18n();
  const groups = groupByRoot(nodes);

  const rootLabels = useMemo(
    () => ({
      '/home': { label: t('tree.root.home'), icon: '🎮' },
      '/var': { label: t('tree.root.var'), icon: '🌐' },
      '/etc': { label: t('tree.root.etc'), icon: '⚙️' },
      '/opt': { label: t('tree.root.opt'), icon: '📦' },
      '__orphans__': { label: t('tree.root.__orphans__'), icon: '⚠️' },
    }),
    [t],
  );

  const sorted = [...groups.entries()].sort(([a], [b]) => {
    if (a === '__orphans__') return 1;
    if (b === '__orphans__') return -1;
    return a.localeCompare(b);
  });

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-text4">
        <svg className="w-12 h-12 mb-4 text-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
        </svg>
        <p className="text-sm">{t('tree.empty')}</p>
      </div>
    );
  }

  return (
    <div>
      {sorted.map(([root, rootNodes]) => (
        <RootSection
          key={root}
          rootKey={root}
          nodes={rootNodes}
          meta={rootLabels[root] ?? { label: t('tree.defaultFolderFallback', { path: root }), icon: '📁' }}
          onRestore={onRestore}
          defaultOpen={root !== '__orphans__'}
        />
      ))}
    </div>
  );
}
