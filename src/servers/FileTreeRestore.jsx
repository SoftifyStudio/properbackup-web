import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

function buildTree(files) {
  const root = { name: '', children: {}, files: [], path: '' };
  for (const f of files) {
    const parts = f.split('/').filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!node.children[dir]) {
        node.children[dir] = { name: dir, children: {}, files: [], path: parts.slice(0, i + 1).join('/') };
      }
      node = node.children[dir];
    }
    node.files.push(parts[parts.length - 1]);
  }
  return root;
}

function getCheckState(node, checked) {
  let total = 0;
  let selected = 0;
  for (const f of node.files) {
    const key = node.path ? `${node.path}/${f}` : f;
    total++;
    if (checked.has(key)) selected++;
  }
  for (const child of Object.values(node.children)) {
    const sub = getCheckState(child, checked);
    total += sub.total;
    selected += sub.selected;
  }
  return { total, selected };
}

function toggleNode(node, checked, newState) {
  const next = new Set(checked);
  for (const f of node.files) {
    const key = node.path ? `${node.path}/${f}` : f;
    if (newState) next.add(key); else next.delete(key);
  }
  for (const child of Object.values(node.children)) {
    toggleNodeInto(child, next, newState);
  }
  return next;
}

function toggleNodeInto(node, set, newState) {
  for (const f of node.files) {
    const key = node.path ? `${node.path}/${f}` : f;
    if (newState) set.add(key); else set.delete(key);
  }
  for (const child of Object.values(node.children)) {
    toggleNodeInto(child, set, newState);
  }
}

const IndeterminateCheckbox = React.memo(function IndeterminateCheckbox({ checked, indeterminate, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-accent w-4 h-4 rounded"
      />
      <span className="text-sm text-text1 truncate">{label}</span>
    </label>
  );
});

const TreeNode = React.memo(function TreeNode({ node, checked, onToggle, depth, expanded, onExpand }) {
  const state = useMemo(() => getCheckState(node, checked), [node, checked]);
  const isChecked = state.total > 0 && state.selected === state.total;
  const isIndeterminate = state.selected > 0 && state.selected < state.total;
  const isExpanded = expanded.has(node.path);
  const hasChildren = Object.keys(node.children).length > 0 || node.files.length > 0;

  const handleToggle = useCallback(() => {
    onToggle(node, !isChecked);
  }, [node, isChecked, onToggle]);

  const handleExpand = useCallback(() => {
    onExpand(node.path);
  }, [node.path, onExpand]);

  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <div className="flex items-center gap-1 py-0.5 hover:bg-surface/50 rounded px-1 group">
        {hasChildren ? (
          <button onClick={handleExpand} className="w-5 h-5 flex items-center justify-center text-text4 hover:text-text2 flex-shrink-0">
            <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : <span className="w-5" />}
        <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        <IndeterminateCheckbox
          checked={isChecked}
          indeterminate={isIndeterminate}
          onChange={handleToggle}
          label={node.name || '/'}
        />
      </div>

      {isExpanded && (
        <>
          {Object.values(node.children)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(child => (
              <TreeNode
                key={child.path}
                node={child}
                checked={checked}
                onToggle={onToggle}
                depth={depth + 1}
                expanded={expanded}
                onExpand={onExpand}
              />
            ))}
          {node.files.sort().map(f => {
            const key = node.path ? `${node.path}/${f}` : f;
            return (
              <div key={key} style={{ paddingLeft: (depth + 1) * 16 }} className="flex items-center gap-1 py-0.5 hover:bg-surface/50 rounded px-1">
                <span className="w-5" />
                <svg className="w-4 h-4 text-text4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checked.has(key)}
                    onChange={() => {
                      const next = new Set(checked);
                      if (next.has(key)) next.delete(key); else next.add(key);
                      onToggle(null, false, next);
                    }}
                    className="accent-accent w-4 h-4 rounded"
                  />
                  <span className="text-sm text-text2 truncate">{f}</span>
                </label>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
});

export default function FileTreeRestore({ files, onRestore, loading }) {
  const { t } = useI18n();
  const [checked, setChecked] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set(['']));

  const tree = useMemo(() => buildTree(files || []), [files]);

  const handleToggle = useCallback((node, newState, directSet) => {
    if (directSet) {
      setChecked(directSet);
      return;
    }
    setChecked(prev => toggleNode(node, prev, newState));
  }, []);

  const handleExpand = useCallback((path) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set(['']);
    const walk = (node) => {
      all.add(node.path);
      Object.values(node.children).forEach(walk);
    };
    walk(tree);
    setExpanded(all);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set(['']));
  }, []);

  const selectAll = useCallback(() => {
    setChecked(toggleNode(tree, new Set(), true));
  }, [tree]);

  const deselectAll = useCallback(() => {
    setChecked(new Set());
  }, []);

  if (!files || files.length === 0) {
    return (
      <div className="text-center text-text3 text-sm py-8">
        {t('restoreTree.noFiles')}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-panel text-xs flex-shrink-0">
        <button onClick={selectAll} className="text-accent hover:underline">{t('restoreTree.selectAll')}</button>
        <span className="text-text4">|</span>
        <button onClick={deselectAll} className="text-accent hover:underline">{t('restoreTree.deselectAll')}</button>
        <span className="text-text4">|</span>
        <button onClick={expandAll} className="text-accent hover:underline">{t('restoreTree.expandAll')}</button>
        <span className="text-text4">|</span>
        <button onClick={collapseAll} className="text-accent hover:underline">{t('restoreTree.collapseAll')}</button>
        <span className="flex-1" />
        <span className="text-text3">{t('restoreTree.selectedCount', { count: checked.size })}</span>
      </div>

      {/* Tree */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 py-1">
        <TreeNode
          node={tree}
          checked={checked}
          onToggle={handleToggle}
          depth={0}
          expanded={expanded}
          onExpand={handleExpand}
        />
      </div>

      {/* Action */}
      {checked.size > 0 && (
        <div className="flex-shrink-0 px-3 py-3 border-t border-border bg-panel">
          <button
            onClick={() => onRestore && onRestore([...checked])}
            disabled={loading}
            className="w-full py-2.5 bg-accent text-white rounded-xl font-semibold text-sm hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? t('restoreTree.restoring') : t('restoreTree.restoreSelected')}
          </button>
        </div>
      )}
    </div>
  );
}
