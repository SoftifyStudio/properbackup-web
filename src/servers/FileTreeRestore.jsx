import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { List as VirtualList } from 'react-window';
import { useI18n } from '../i18n/I18nContext.jsx';

function buildTree(filePaths) {
  const root = { name: '', children: new Map(), files: [], path: '' };
  for (const f of filePaths) {
    const parts = f.split('/').filter(Boolean);
    if (parts.length === 0) continue;
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!node.children.has(dir)) {
        const childPath = parts.slice(0, i + 1).join('/');
        node.children.set(dir, { name: dir, children: new Map(), files: [], path: childPath });
      }
      node = node.children.get(dir);
    }
    node.files.push(parts[parts.length - 1]);
  }
  return root;
}

function getNodeAtPath(root, segments) {
  let node = root;
  for (const seg of segments) {
    if (!node.children.has(seg)) return null;
    node = node.children.get(seg);
  }
  return node;
}

function countAll(node) {
  let n = node.files.length;
  for (const child of node.children.values()) n += countAll(child);
  return n;
}

function countChecked(node, checked) {
  let n = 0;
  for (const f of node.files) {
    const key = node.path ? `${node.path}/${f}` : f;
    if (checked.has(key)) n++;
  }
  for (const child of node.children.values()) n += countChecked(child, checked);
  return n;
}

function toggleAllUnder(node, set, on) {
  for (const f of node.files) {
    const key = node.path ? `${node.path}/${f}` : f;
    if (on) set.add(key); else set.delete(key);
  }
  for (const child of node.children.values()) toggleAllUnder(child, set, on);
}

const ROW_HEIGHT = 40;
const MAX_LIST_HEIGHT = 560;

const IndeterminateCheckbox = React.memo(function IndeterminateCheckbox({ checked, indeterminate, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="accent-accent w-4 h-4 rounded cursor-pointer shrink-0"
    />
  );
});

export default function FileTreeRestore({ files, onRestore, loading }) {
  const { t } = useI18n();
  const [checked, setChecked] = useState(new Set());
  const [currentPath, setCurrentPath] = useState([]);

  const tree = useMemo(() => buildTree(files || []), [files]);

  const currentNode = useMemo(
    () => getNodeAtPath(tree, currentPath) || tree,
    [tree, currentPath],
  );

  const entries = useMemo(() => {
    const result = [];
    const folders = [...currentNode.children.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, node]) => ({ type: 'folder', name, node }));
    result.push(...folders);

    const sortedFiles = [...currentNode.files].sort((a, b) => a.localeCompare(b));
    for (const f of sortedFiles) {
      result.push({ type: 'file', name: f, fullPath: currentNode.path ? `${currentNode.path}/${f}` : f });
    }
    return result;
  }, [currentNode]);

  const navigateIn = useCallback((folderName) => {
    setCurrentPath(prev => [...prev, folderName]);
  }, []);

  const navigateTo = useCallback((segments) => {
    setCurrentPath(segments);
  }, []);

  const handleFolderToggle = useCallback((node) => {
    setChecked(prev => {
      const next = new Set(prev);
      const total = countAll(node);
      const sel = countChecked(node, next);
      toggleAllUnder(node, next, sel < total);
      return next;
    });
  }, []);

  const handleFileToggle = useCallback((fullPath) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(fullPath)) next.delete(fullPath); else next.add(fullPath);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setChecked(() => {
      const next = new Set();
      toggleAllUnder(tree, next, true);
      return next;
    });
  }, [tree]);

  const deselectAll = useCallback(() => setChecked(new Set()), []);

  if (!files || files.length === 0) {
    return (
      <div className="text-center text-text3 text-sm py-8">
        {t('restoreTree.noFiles')}
      </div>
    );
  }

  const hasBackRow = currentPath.length > 0;
  const itemCount = entries.length + (hasBackRow ? 1 : 0);
  const listHeight = Math.min(itemCount * ROW_HEIGHT, MAX_LIST_HEIGHT);

  const Row = ({ index, style }) => {
    if (hasBackRow && index === 0) {
      return (
        <div
          style={style}
          className="flex items-center gap-3 px-4 cursor-pointer hover:bg-surface/60 border-b border-border"
          onClick={() => navigateTo(currentPath.slice(0, -1))}
        >
          <span className="w-4" />
          <svg className="w-4 h-4 text-accent shrink-0" viewBox="0 0 16 16" fill="none">
            <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-sm text-accent font-medium">..</span>
        </div>
      );
    }

    const entryIdx = hasBackRow ? index - 1 : index;
    const entry = entries[entryIdx];
    if (!entry) return null;

    if (entry.type === 'folder') {
      const { node } = entry;
      const total = countAll(node);
      const sel = countChecked(node, checked);
      const isChecked = total > 0 && sel === total;
      const isIndeterminate = sel > 0 && sel < total;

      return (
        <div style={style} className="flex items-center gap-3 px-4 border-b border-border hover:bg-surface/60">
          <IndeterminateCheckbox
            checked={isChecked}
            indeterminate={isIndeterminate}
            onChange={() => handleFolderToggle(node)}
          />
          <svg className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span
            className="flex-1 text-sm text-text1 truncate cursor-pointer hover:text-accent hover:underline"
            onClick={() => navigateIn(entry.name)}
          >
            {entry.name}
          </span>
          <span className="text-xs text-text4 shrink-0 tabular-nums">{total}</span>
        </div>
      );
    }

    const isFileChecked = checked.has(entry.fullPath);
    return (
      <div style={style} className="flex items-center gap-3 px-4 border-b border-border hover:bg-surface/60">
        <input
          type="checkbox"
          checked={isFileChecked}
          onChange={() => handleFileToggle(entry.fullPath)}
          className="accent-accent w-4 h-4 rounded cursor-pointer shrink-0"
        />
        <svg className="w-4 h-4 text-text4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <span className="flex-1 text-sm text-text2 truncate">{entry.name}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-panel text-sm min-h-[36px] flex-shrink-0 overflow-x-auto">
        <button className="text-accent hover:underline font-medium shrink-0" onClick={() => navigateTo([])}>
          /
        </button>
        {currentPath.map((seg, i) => (
          <React.Fragment key={i}>
            <svg className="w-3 h-3 text-text4 shrink-0 mx-0.5" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <button
              className={`shrink-0 ${i === currentPath.length - 1 ? 'text-text1 font-medium' : 'text-accent hover:underline'}`}
              onClick={() => navigateTo(currentPath.slice(0, i + 1))}
            >
              {seg}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-panel text-xs flex-shrink-0">
        <button onClick={selectAll} className="text-accent hover:underline">{t('restoreTree.selectAll')}</button>
        <span className="text-text4">|</span>
        <button onClick={deselectAll} className="text-accent hover:underline">{t('restoreTree.deselectAll')}</button>
        <span className="flex-1" />
        <span className="text-text3">{t('restoreTree.selectedCount', { count: checked.size })}</span>
      </div>

      {/* Virtualized flat list */}
      <div className="flex-1 min-h-0">
        {entries.length === 0 && currentPath.length === 0 ? (
          <div className="text-center text-text3 text-sm py-8">
            {t('restoreTree.noFiles')}
          </div>
        ) : (
          <VirtualList
            height={listHeight}
            itemCount={itemCount}
            itemSize={ROW_HEIGHT}
            width="100%"
            overscanCount={15}
          >
            {Row}
          </VirtualList>
        )}
      </div>

      {/* Restore action */}
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
