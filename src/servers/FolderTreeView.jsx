import React, { useMemo, useState, useCallback } from 'react';
import { List as VirtualList } from 'react-window';

function getFolderIcon(isOpen) {
  return isOpen ? (
    <svg className="w-5 h-5 text-accent shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v1H8a3 3 0 00-2.83 2H2V6z"/>
      <path d="M5.17 11A2 2 0 017 9.5h11a1 1 0 01.98 1.2l-1.5 7.5a2 2 0 01-1.96 1.6H4.52a2 2 0 01-1.96-1.6L1.06 10.7A1 1 0 012.04 9.5H5c.06 0 .12.01.17.02V11z"/>
    </svg>
  ) : (
    <svg className="w-5 h-5 text-accent/70 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
    </svg>
  );
}

function getFileIcon(status) {
  const colors = {
    current: 'text-success',
    changed: 'text-accent',
    new: 'text-blue-500',
    deleted: 'text-danger',
  };
  const color = colors[status] || 'text-text3';
  return (
    <svg className={`w-4.5 h-4.5 ${color} shrink-0`} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
    </svg>
  );
}

function StatusDot({ status }) {
  const colors = {
    current: 'bg-success',
    changed: 'bg-accent',
    new: 'bg-blue-500',
    deleted: 'bg-danger',
  };
  return (
    <span className={`w-1.5 h-1.5 rounded-full ${colors[status] || 'bg-text4'} shrink-0`} />
  );
}

function buildFolderTree(files) {
  const root = { name: '/', children: new Map(), files: [], path: '/' };

  for (const file of files) {
    const parts = (file.fullPath || file.path || '').split('/').filter(Boolean);
    if (parts.length === 0) continue;

    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const segment = parts[i];
      if (!node.children.has(segment)) {
        const childPath = '/' + parts.slice(0, i + 1).join('/');
        node.children.set(segment, {
          name: segment,
          children: new Map(),
          files: [],
          path: childPath,
        });
      }
      node = node.children.get(segment);
    }
    node.files.push(file);
  }

  return root;
}

function getNodeAtPath(root, pathSegments) {
  let node = root;
  for (const segment of pathSegments) {
    if (!node.children.has(segment)) return null;
    node = node.children.get(segment);
  }
  return node;
}

function Breadcrumb({ segments, onNavigate }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-text3 overflow-x-auto px-1 py-1.5">
      <button
        className="text-accent hover:text-accent/80 font-medium shrink-0"
        onClick={() => onNavigate([])}
      >
        /
      </button>
      {segments.map((seg, i) => (
        <React.Fragment key={i}>
          <span className="text-text4 shrink-0">/</span>
          <button
            className={`shrink-0 ${i === segments.length - 1 ? 'text-text1 font-medium' : 'text-accent hover:text-accent/80'}`}
            onClick={() => onNavigate(segments.slice(0, i + 1))}
          >
            {seg}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}

export default function FolderTreeView({ files, newPaths, formatDateTime }) {
  const [currentPath, setCurrentPath] = useState([]);

  const tree = useMemo(() => buildFolderTree(files), [files]);

  const currentNode = useMemo(() => {
    return getNodeAtPath(tree, currentPath) || tree;
  }, [tree, currentPath]);

  const entries = useMemo(() => {
    const result = [];
    const folders = [...currentNode.children.entries()]
      .sort(([a], [b]) => a.localeCompare(b));

    for (const [name, node] of folders) {
      let fileCount = 0;
      const countFiles = (n) => {
        fileCount += n.files.length;
        for (const c of n.children.values()) countFiles(c);
      };
      countFiles(node);
      result.push({ type: 'folder', name, path: node.path, fileCount });
    }

    const sortedFiles = [...currentNode.files].sort((a, b) => {
      const nameA = (a.fullPath || a.path || '').split('/').pop() || '';
      const nameB = (b.fullPath || b.path || '').split('/').pop() || '';
      return nameA.localeCompare(nameB);
    });

    for (const file of sortedFiles) {
      const fileName = (file.fullPath || file.path || '').split('/').pop() || '';
      result.push({ type: 'file', name: fileName, file });
    }

    return result;
  }, [currentNode]);

  const navigateToFolder = useCallback((name) => {
    setCurrentPath((prev) => [...prev, name]);
  }, []);

  const ROW_HEIGHT = 40;
  const listHeight = Math.min(entries.length * ROW_HEIGHT, 560);

  const renderRow = useCallback(({ index, style }) => {
    const entry = entries[index];
    if (!entry) return null;

    if (entry.type === 'folder') {
      return (
        <div
          style={style}
          className="flex items-center gap-3 px-4 hover:bg-accent/[0.04] cursor-pointer transition-colors border-b border-border/30"
          onClick={() => navigateToFolder(entry.name)}
        >
          {getFolderIcon(false)}
          <span className="flex-1 text-sm font-medium text-text1 truncate">{entry.name}</span>
          <span className="text-xs text-text4 shrink-0">{entry.fileCount} files</span>
          <svg className="w-4 h-4 text-text4 shrink-0" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      );
    }

    const f = entry.file;
    const isNew = newPaths && newPaths.has(f.fullPath || f.path);
    return (
      <div
        style={style}
        className={`flex items-center gap-3 px-4 hover:bg-surface/60 transition-colors border-b border-border/30 ${
          isNew ? 'animate-fade-in-row' : ''
        }`}
      >
        <StatusDot status={f.status} />
        {getFileIcon(f.status)}
        <span className={`flex-1 text-sm truncate ${f.status === 'deleted' ? 'line-through text-text4' : 'text-text2'}`}>
          {entry.name}
        </span>
        <div className="shrink-0 flex items-center gap-3">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
            f.status === 'current' ? 'bg-successLight text-success'
            : f.status === 'changed' ? 'bg-accent/10 text-accent'
            : f.status === 'new' ? 'bg-blue-50 text-blue-600'
            : f.status === 'deleted' ? 'bg-dangerLight text-danger'
            : 'bg-surface text-text4'
          }`}>
            {f.status || '—'}
          </span>
          <span className="text-xs text-text4 w-[9rem] text-right">
            {f.updatedAt ? formatDateTime(f.updatedAt) : '—'}
          </span>
        </div>
      </div>
    );
  }, [entries, newPaths, navigateToFolder, formatDateTime]);

  return (
    <div className="space-y-2">
      <Breadcrumb segments={currentPath} onNavigate={setCurrentPath} />

      <div className="rounded-xl2 border border-border bg-panel overflow-hidden shadow-card">
        {/* Column header */}
        <div className="flex items-center gap-3 px-4 py-2 bg-surface/90 border-b border-border">
          <span className="shrink-0 w-1.5" />
          <span className="shrink-0 w-5" />
          <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-text4">
            Name
          </span>
          <div className="shrink-0 flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text4 w-[5.5rem] text-center">
              Status
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text4 w-[9rem] text-right">
              Updated
            </span>
          </div>
        </div>

        {/* Navigable list */}
        {currentPath.length > 0 && (
          <div
            className="flex items-center gap-3 px-4 py-2 hover:bg-surface/60 cursor-pointer transition-colors border-b border-border/30 text-accent"
            onClick={() => setCurrentPath((p) => p.slice(0, -1))}
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-medium">..</span>
          </div>
        )}

        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-text4">
            <svg className="w-10 h-10 mb-3 text-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
            </svg>
            <p className="text-sm">Empty folder</p>
          </div>
        )}

        {entries.length > 0 && entries.length > 200 ? (
          <VirtualList
            height={listHeight}
            itemCount={entries.length}
            itemSize={ROW_HEIGHT}
            width="100%"
            overscanCount={20}
          >
            {renderRow}
          </VirtualList>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            {entries.map((entry, i) => (
              <div key={entry.type === 'folder' ? `d-${entry.name}` : `f-${entry.file.fullPath || entry.file.path}`}>
                {renderRow({ index: i, style: {} })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
