import React from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

const EXT_ICONS = {
  // Images
  jpg: { color: 'text-pink-500', d: 'M2.5 2A1.5 1.5 0 014 .5h8A1.5 1.5 0 0113.5 2v12a1.5 1.5 0 01-1.5 1.5H4A1.5 1.5 0 012.5 14V2zm2 7.5l2-2 1.5 1.5 3-3 2.5 2.5' },
  jpeg: { color: 'text-pink-500' },
  png: { color: 'text-pink-500' },
  gif: { color: 'text-pink-500' },
  webp: { color: 'text-pink-500' },
  svg: { color: 'text-pink-500' },
  bmp: { color: 'text-pink-500' },
  // Code
  java: { color: 'text-orange-500' },
  kt: { color: 'text-violet-500' },
  kts: { color: 'text-violet-500' },
  js: { color: 'text-yellow-500' },
  jsx: { color: 'text-yellow-500' },
  ts: { color: 'text-blue-500' },
  tsx: { color: 'text-blue-500' },
  py: { color: 'text-green-600' },
  rs: { color: 'text-orange-600' },
  go: { color: 'text-cyan-500' },
  c: { color: 'text-blue-400' },
  cpp: { color: 'text-blue-400' },
  h: { color: 'text-blue-400' },
  cs: { color: 'text-purple-500' },
  rb: { color: 'text-red-500' },
  php: { color: 'text-indigo-400' },
  sh: { color: 'text-green-500' },
  bash: { color: 'text-green-500' },
  // Data / config
  json: { color: 'text-yellow-600' },
  xml: { color: 'text-orange-400' },
  yaml: { color: 'text-red-400' },
  yml: { color: 'text-red-400' },
  toml: { color: 'text-gray-500' },
  ini: { color: 'text-gray-500' },
  env: { color: 'text-gray-500' },
  properties: { color: 'text-gray-500' },
  sql: { color: 'text-blue-500' },
  csv: { color: 'text-green-500' },
  // Documents
  pdf: { color: 'text-red-600' },
  doc: { color: 'text-blue-600' },
  docx: { color: 'text-blue-600' },
  xls: { color: 'text-green-600' },
  xlsx: { color: 'text-green-600' },
  ppt: { color: 'text-orange-500' },
  pptx: { color: 'text-orange-500' },
  md: { color: 'text-gray-600' },
  txt: { color: 'text-gray-500' },
  // Archives
  zip: { color: 'text-amber-600' },
  tar: { color: 'text-amber-600' },
  gz: { color: 'text-amber-600' },
  rar: { color: 'text-amber-600' },
  '7z': { color: 'text-amber-600' },
  // Media
  mp4: { color: 'text-purple-500' },
  mkv: { color: 'text-purple-500' },
  avi: { color: 'text-purple-500' },
  mov: { color: 'text-purple-500' },
  mp3: { color: 'text-green-500' },
  wav: { color: 'text-green-500' },
  flac: { color: 'text-green-500' },
  // Build/lock
  jar: { color: 'text-orange-500' },
  war: { color: 'text-orange-500' },
  class: { color: 'text-orange-400' },
  lock: { color: 'text-gray-400' },
  log: { color: 'text-gray-400' },
};

const STATUS_STYLES = {
  current:  { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Synced' },
  changed:  { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Modified' },
  deleted:  { bg: 'bg-red-50', text: 'text-red-700', label: 'Deleted' },
  new:      { bg: 'bg-blue-50', text: 'text-blue-700', label: 'New' },
  uploaded: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Uploaded' },
  error:    { bg: 'bg-red-50', text: 'text-red-700', label: 'Error' },
};

function getFileInfo(fullPath) {
  if (!fullPath) return { name: '', dir: '', ext: '' };
  const parts = fullPath.replace(/\\/g, '/').split('/');
  const name = parts[parts.length - 1] || '';
  const dir = parts.slice(0, -1).join('/');
  const dotIdx = name.lastIndexOf('.');
  const ext = dotIdx > 0 ? name.slice(dotIdx + 1).toLowerCase() : '';
  return { name, dir, ext };
}

function FileIcon({ ext }) {
  const iconInfo = EXT_ICONS[ext];
  const color = iconInfo?.color || 'text-text4';

  // Image file — photo icon
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return (
      <svg className={`shrink-0 w-5 h-5 ${color}`} viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
        <circle cx="5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1"/>
        <path d="M1.5 11l3-3 2 2 3-3 5 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }

  // Archive — zip icon
  if (['zip', 'tar', 'gz', 'rar', '7z', 'jar', 'war'].includes(ext)) {
    return (
      <svg className={`shrink-0 w-5 h-5 ${color}`} viewBox="0 0 16 16" fill="none">
        <path d="M3 2.5A1.5 1.5 0 014.5 1h4.379a1.5 1.5 0 011.06.44l2.122 2.12A1.5 1.5 0 0112.5 4.622V13.5A1.5 1.5 0 0111 15H4.5A1.5 1.5 0 013 13.5v-11z" stroke="currentColor" strokeWidth="1.1"/>
        <path d="M7 4h2M7 6h2M7 8h2M7 10h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    );
  }

  // Media — play icon
  if (['mp4', 'mkv', 'avi', 'mov', 'mp3', 'wav', 'flac'].includes(ext)) {
    return (
      <svg className={`shrink-0 w-5 h-5 ${color}`} viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
        <path d="M6.5 5.5l4 2.5-4 2.5V5.5z" fill="currentColor"/>
      </svg>
    );
  }

  // Code file — angle brackets
  if (['java', 'kt', 'kts', 'js', 'jsx', 'ts', 'tsx', 'py', 'rs', 'go', 'c', 'cpp', 'h', 'cs', 'rb', 'php', 'sh', 'bash'].includes(ext)) {
    return (
      <svg className={`shrink-0 w-5 h-5 ${color}`} viewBox="0 0 16 16" fill="none">
        <path d="M3 2.5A1.5 1.5 0 014.5 1h4.379a1.5 1.5 0 011.06.44l2.122 2.12A1.5 1.5 0 0112.5 4.622V13.5A1.5 1.5 0 0111 15H4.5A1.5 1.5 0 013 13.5v-11z" stroke="currentColor" strokeWidth="1.1"/>
        <path d="M6.5 7L5 8.5 6.5 10M9.5 7L11 8.5 9.5 10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }

  // Config/data
  if (['json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'env', 'properties', 'sql', 'csv'].includes(ext)) {
    return (
      <svg className={`shrink-0 w-5 h-5 ${color}`} viewBox="0 0 16 16" fill="none">
        <path d="M3 2.5A1.5 1.5 0 014.5 1h4.379a1.5 1.5 0 011.06.44l2.122 2.12A1.5 1.5 0 0112.5 4.622V13.5A1.5 1.5 0 0111 15H4.5A1.5 1.5 0 013 13.5v-11z" stroke="currentColor" strokeWidth="1.1"/>
        <path d="M5.5 7h5M5.5 9h3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    );
  }

  // Default document
  return (
    <svg className={`shrink-0 w-5 h-5 ${color}`} viewBox="0 0 16 16" fill="none">
      <path d="M3 2.5A1.5 1.5 0 014.5 1h4.379a1.5 1.5 0 011.06.44l2.122 2.12A1.5 1.5 0 0112.5 4.622V13.5A1.5 1.5 0 0111 15H4.5A1.5 1.5 0 013 13.5v-11z" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M9 1v3.5h3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

export default function FileListItem({ file, formatDateTime }) {
  const { t } = useI18n();
  const { name, dir, ext } = getFileInfo(file.fullPath);
  const isRecent = file.updatedAt && (Date.now() - new Date(file.updatedAt).getTime()) < 10_000;
  const st = STATUS_STYLES[file.status] || STATUS_STYLES.current;

  return (
    <div
      className={`group flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0 transition-colors duration-200 ${
        isRecent ? 'bg-accent/[0.04]' : 'hover:bg-surface/60'
      }`}
    >
      {/* Activity dot */}
      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${isRecent ? 'bg-accent' : 'bg-transparent'}`} />

      {/* File icon */}
      <FileIcon ext={ext} />

      {/* File name + path */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-text1 truncate leading-tight" title={file.fullPath}>
          {name || file.fullPath}
        </div>
        {dir && (
          <div className="text-[11px] text-text4 font-mono truncate leading-tight mt-0.5" title={dir}>
            {dir}
          </div>
        )}
      </div>

      {/* Right side: status + timestamp */}
      <div className="shrink-0 flex items-center gap-3">
        <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
          {file.status === 'current' && (
            <svg className="w-3 h-3 mr-1" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {file.status === 'changed' && (
            <svg className="w-3 h-3 mr-1" viewBox="0 0 12 12" fill="none">
              <path d="M6 3v4M6 9h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )}
          {file.status === 'deleted' && (
            <svg className="w-3 h-3 mr-1" viewBox="0 0 12 12" fill="none">
              <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )}
          {st.label}
        </span>
        <span className="text-[11px] text-text4 tabular-nums w-[9rem] text-right">
          {formatDateTime(file.updatedAt)}
        </span>
      </div>
    </div>
  );
}
