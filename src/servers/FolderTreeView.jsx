import React, { useMemo, useState, useCallback } from 'react';
import { List as VirtualList } from 'react-window';

/* ── OneDrive-style file-type icon colors ── */
const EXT_COLORS = {
  jpg: 'text-pink-500', jpeg: 'text-pink-500', png: 'text-pink-500', gif: 'text-pink-500',
  webp: 'text-pink-500', svg: 'text-pink-500', bmp: 'text-pink-500',
  java: 'text-orange-500', kt: 'text-violet-500', kts: 'text-violet-500',
  js: 'text-yellow-500', jsx: 'text-yellow-500', ts: 'text-blue-500', tsx: 'text-blue-500',
  py: 'text-green-600', rs: 'text-orange-600', go: 'text-cyan-500',
  c: 'text-blue-400', cpp: 'text-blue-400', h: 'text-blue-400', cs: 'text-purple-500',
  rb: 'text-red-500', php: 'text-indigo-400', sh: 'text-green-500', bash: 'text-green-500',
  json: 'text-yellow-600', xml: 'text-orange-400', yaml: 'text-red-400', yml: 'text-red-400',
  toml: 'text-gray-500', ini: 'text-gray-500', env: 'text-gray-500',
  sql: 'text-blue-500', csv: 'text-green-500',
  pdf: 'text-red-600', doc: 'text-blue-600', docx: 'text-blue-600',
  xls: 'text-green-600', xlsx: 'text-green-600', md: 'text-gray-600', txt: 'text-gray-500',
  zip: 'text-amber-600', tar: 'text-amber-600', gz: 'text-amber-600', rar: 'text-amber-600',
  mp4: 'text-purple-500', mkv: 'text-purple-500', mp3: 'text-green-500', wav: 'text-green-500',
  jar: 'text-orange-500', log: 'text-gray-400', lock: 'text-gray-400',
  dat: 'text-gray-500', mca: 'text-emerald-600', properties: 'text-gray-500',
};
const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','webp','svg','bmp']);
const ARCHIVE_EXTS = new Set(['zip','tar','gz','rar','7z','jar','war']);
const MEDIA_EXTS = new Set(['mp4','mkv','avi','mov','mp3','wav','flac']);
const CODE_EXTS = new Set(['java','kt','kts','js','jsx','ts','tsx','py','rs','go','c','cpp','h','cs','rb','php','sh','bash']);

function FileIcon({ ext }) {
  const color = EXT_COLORS[ext] || 'text-text4';
  if (IMAGE_EXTS.has(ext)) return (
    <svg className={`shrink-0 w-[18px] h-[18px] ${color}`} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
      <circle cx="5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1"/>
      <path d="M1.5 11l3-3 2 2 3-3 5 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (ARCHIVE_EXTS.has(ext)) return (
    <svg className={`shrink-0 w-[18px] h-[18px] ${color}`} viewBox="0 0 16 16" fill="none">
      <path d="M3 2.5A1.5 1.5 0 014.5 1h4.379a1.5 1.5 0 011.06.44l2.122 2.12A1.5 1.5 0 0112.5 4.622V13.5A1.5 1.5 0 0111 15H4.5A1.5 1.5 0 013 13.5v-11z" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M7 4h2M7 6h2M7 8h2M7 10h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
  if (MEDIA_EXTS.has(ext)) return (
    <svg className={`shrink-0 w-[18px] h-[18px] ${color}`} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M6.5 5.5l4 2.5-4 2.5V5.5z" fill="currentColor"/>
    </svg>
  );
  if (CODE_EXTS.has(ext)) return (
    <svg className={`shrink-0 w-[18px] h-[18px] ${color}`} viewBox="0 0 16 16" fill="none">
      <path d="M3 2.5A1.5 1.5 0 014.5 1h4.379a1.5 1.5 0 011.06.44l2.122 2.12A1.5 1.5 0 0112.5 4.622V13.5A1.5 1.5 0 0111 15H4.5A1.5 1.5 0 013 13.5v-11z" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M6.5 7L5 8.5 6.5 10M9.5 7L11 8.5 9.5 10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  return (
    <svg className={`shrink-0 w-[18px] h-[18px] ${color}`} viewBox="0 0 16 16" fill="none">
      <path d="M3 2.5A1.5 1.5 0 014.5 1h4.379a1.5 1.5 0 011.06.44l2.122 2.12A1.5 1.5 0 0112.5 4.622V13.5A1.5 1.5 0 0111 15H4.5A1.5 1.5 0 013 13.5v-11z" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M9 1v3.5h3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="w-[18px] h-[18px] text-accent/80 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
    </svg>
  );
}

const STATUS_STYLES = {
  current: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Synced' },
  changed: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Modified' },
  deleted: { bg: 'bg-red-50', text: 'text-red-700', label: 'Deleted' },
  new:     { bg: 'bg-blue-50', text: 'text-blue-700', label: 'New' },
};

function fmtRelativeTime(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  if (diff < 604800_000) return `${Math.floor(diff / 86400_000)}d ago`;
  return new Date(isoStr).toLocaleDateString();
}

function getExt(name) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function countAllFiles(node) {
  let count = node.files.length;
  for (const c of node.children.values()) count += countAllFiles(c);
  return count;
}

function getLatestUpdate(node) {
  let latest = 0;
  for (const f of node.files) {
    const t = f.updatedAt ? new Date(f.updatedAt).getTime() : 0;
    if (t > latest) latest = t;
  }
  for (const c of node.children.values()) {
    const t = getLatestUpdate(c);
    if (t > latest) latest = t;
  }
  return latest;
}

function SortArrow({ direction }) {
  if (!direction) return null;
  return (
    <svg className="w-3 h-3 ml-0.5 inline-block" viewBox="0 0 12 12" fill="none">
      {direction === 'asc' ? (
        <path d="M6 3v6M3.5 5.5L6 3l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      ) : (
        <path d="M6 9V3M3.5 6.5L6 9l2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      )}
    </svg>
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
    <nav className="flex items-center gap-0.5 text-sm text-text3 overflow-x-auto px-4 py-2.5 bg-panel border-b border-border">
      <button
        className="text-accent hover:text-accent/80 hover:underline font-medium shrink-0 px-1"
        onClick={() => onNavigate([])}
      >
        My Server
      </button>
      {segments.map((seg, i) => (
        <React.Fragment key={i}>
          <svg className="w-3.5 h-3.5 text-text4 shrink-0" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <button
            className={`shrink-0 px-1 ${i === segments.length - 1 ? 'text-text1 font-medium' : 'text-accent hover:text-accent/80 hover:underline'}`}
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
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(null);

  const tree = useMemo(() => buildFolderTree(files), [files]);

  const currentNode = useMemo(() => {
    return getNodeAtPath(tree, currentPath) || tree;
  }, [tree, currentPath]);

  const toggleSort = useCallback((col) => {
    setSortCol((prev) => {
      if (prev === col) {
        setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
        return col;
      }
      setSortDir('asc');
      return col;
    });
  }, []);

  const entries = useMemo(() => {
    const result = [];
    const folders = [...currentNode.children.entries()].map(([name, node]) => ({
      type: 'folder', name, path: node.path,
      fileCount: countAllFiles(node),
      latestUpdate: getLatestUpdate(node),
    }));
    const sortedFolders = [...folders].sort((a, b) => {
      if (sortCol === 'name') return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      if (sortCol === 'modified') return sortDir === 'asc' ? a.latestUpdate - b.latestUpdate : b.latestUpdate - a.latestUpdate;
      return a.name.localeCompare(b.name);
    });
    result.push(...sortedFolders);

    const fileEntries = currentNode.files.map((f) => {
      const fullPath = f.fullPath || f.path || '';
      const name = fullPath.split('/').pop() || '';
      return { type: 'file', name, file: f, ext: getExt(name) };
    });
    const sortedFiles = [...fileEntries].sort((a, b) => {
      if (sortCol === 'name') return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      if (sortCol === 'modified') {
        const ta = a.file.updatedAt ? new Date(a.file.updatedAt).getTime() : 0;
        const tb = b.file.updatedAt ? new Date(b.file.updatedAt).getTime() : 0;
        return sortDir === 'asc' ? ta - tb : tb - ta;
      }
      if (sortCol === 'status') {
        return sortDir === 'asc'
          ? (a.file.status || '').localeCompare(b.file.status || '')
          : (b.file.status || '').localeCompare(a.file.status || '');
      }
      return a.name.localeCompare(b.name);
    });
    result.push(...sortedFiles);

    return result;
  }, [currentNode, sortCol, sortDir]);

  const navigateToFolder = useCallback((name) => {
    setCurrentPath((prev) => [...prev, name]);
    setSelected(null);
  }, []);

  const ROW_HEIGHT = 44;
  const listHeight = Math.min(entries.length * ROW_HEIGHT, 640);

  const renderRow = useCallback(({ index, style }) => {
    const entry = entries[index];
    if (!entry) return null;
    const isSelected = selected === index;

    if (entry.type === 'folder') {
      return (
        <div
          style={style}
          className={`flex items-center gap-3 px-4 cursor-pointer transition-colors border-b border-border/30 group ${
            isSelected ? 'bg-accent/[0.06]' : 'hover:bg-[#f3f3f3]'
          }`}
          onClick={() => navigateToFolder(entry.name)}
          onContextMenu={(e) => { e.preventDefault(); setSelected(index); }}
        >
          <FolderIcon />
          <span className="flex-1 text-[13px] font-medium text-text1 truncate">{entry.name}</span>
          <span className="text-xs text-text4 w-[7rem] text-right shrink-0">
            {entry.latestUpdate > 0 ? fmtRelativeTime(new Date(entry.latestUpdate).toISOString()) : ''}
          </span>
          <span className="text-xs text-text4 w-[5rem] text-right shrink-0 tabular-nums">
            {entry.fileCount} {entry.fileCount === 1 ? 'item' : 'items'}
          </span>
          <svg className="w-4 h-4 text-text4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      );
    }

    const f = entry.file;
    const isNew = newPaths && newPaths.has(f.fullPath || f.path);
    const st = STATUS_STYLES[f.status] || STATUS_STYLES.current;

    return (
      <div
        style={style}
        className={`flex items-center gap-3 px-4 transition-colors border-b border-border/30 cursor-default group ${
          isNew ? 'animate-fade-in-row' : isSelected ? 'bg-accent/[0.06]' : 'hover:bg-[#f3f3f3]'
        }`}
        onClick={() => setSelected(index)}
      >
        <FileIcon ext={entry.ext} />
        <div className="flex-1 min-w-0">
          <span className={`text-[13px] truncate block ${f.status === 'deleted' ? 'line-through text-text4' : 'text-text1'}`}>
            {entry.name}
          </span>
        </div>
        <span className="text-xs text-text4 w-[7rem] text-right shrink-0 tabular-nums">
          {f.updatedAt ? fmtRelativeTime(f.updatedAt) : ''}
        </span>
        <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full w-[5rem] justify-center shrink-0 ${st.bg} ${st.text}`}>
          {st.label}
        </span>
      </div>
    );
  }, [entries, newPaths, navigateToFolder, selected]);

  return (
    <div className="rounded-xl2 border border-border bg-panel overflow-hidden shadow-card">
      {/* OneDrive-style breadcrumb path bar */}
      <Breadcrumb segments={currentPath} onNavigate={(segs) => { setCurrentPath(segs); setSelected(null); }} />

      {/* Column header (sortable) */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#fafafa] border-b border-border select-none">
        <span className="shrink-0 w-[18px]" />
        <button
          className="flex-1 flex items-center text-[11px] font-semibold uppercase tracking-wide text-text4 hover:text-text2 text-left"
          onClick={() => toggleSort('name')}
        >
          Name
          {sortCol === 'name' && <SortArrow direction={sortDir} />}
        </button>
        <button
          className="w-[7rem] flex items-center justify-end text-[11px] font-semibold uppercase tracking-wide text-text4 hover:text-text2 shrink-0"
          onClick={() => toggleSort('modified')}
        >
          Modified
          {sortCol === 'modified' && <SortArrow direction={sortDir} />}
        </button>
        <button
          className="w-[5rem] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-text4 hover:text-text2 shrink-0"
          onClick={() => toggleSort('status')}
        >
          Status
          {sortCol === 'status' && <SortArrow direction={sortDir} />}
        </button>
        <span className="shrink-0 w-4" />
      </div>

      {/* Back row */}
      {currentPath.length > 0 && (
        <div
          className="flex items-center gap-3 px-4 h-[44px] hover:bg-[#f3f3f3] cursor-pointer transition-colors border-b border-border/30"
          onClick={() => { setCurrentPath((p) => p.slice(0, -1)); setSelected(null); }}
        >
          <svg className="w-[18px] h-[18px] text-accent" viewBox="0 0 16 16" fill="none">
            <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[13px] text-accent font-medium">Back</span>
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-text4">
          <svg className="w-12 h-12 mb-3 text-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
          </svg>
          <p className="text-sm font-medium text-text3">This folder is empty</p>
          <p className="text-xs text-text4 mt-1">No files or folders here yet</p>
        </div>
      )}

      {/* File/folder rows - virtualized when > 200, otherwise plain */}
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
      ) : entries.length > 0 ? (
        <div className="max-h-[75vh] overflow-y-auto">
          {entries.map((entry, i) => (
            <div key={entry.type === 'folder' ? `d-${entry.name}` : `f-${entry.file.fullPath || entry.file.path}`}>
              {renderRow({ index: i, style: {} })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
