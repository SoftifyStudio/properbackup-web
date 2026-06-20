import React from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

function fmtBytes(n) {
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GiB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${n} B`;
}

function FileList({ label, files, color, icon, maxItems = 10 }) {
  if (!files || files.length === 0) return null;
  const shown = files.slice(0, maxItems);
  const remaining = files.length - shown.length;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs font-semibold text-text1">{label}</span>
        <span className="text-xs text-text4 ml-auto">{files.length}</span>
      </div>
      <div className="bg-surface rounded-lg border border-border/50 divide-y divide-border/30">
        {shown.map((f, i) => (
          <div key={i} className="px-3 py-1.5 text-xs font-mono text-text2 truncate">
            {typeof f === 'string' ? f : f.path || f}
          </div>
        ))}
        {remaining > 0 && (
          <div className="px-3 py-1.5 text-xs text-text4">
            +{remaining} more
          </div>
        )}
      </div>
    </div>
  );
}

export default function DryRunPreview({ session, onConfirm, onCancel, loading }) {
  const { t } = useI18n();
  const dryRun = session || {};

  return (
    <div className="space-y-4">
      <div className="bg-warnLight border border-warn/20 rounded-xl2 p-4 mb-2">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-warn" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-warn text-sm font-semibold">{t('recovery.mode.dryRunTitle')}</span>
        </div>
        <p className="text-text2 text-sm">{t('recovery.mode.dryRunExplain')}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-panel rounded-xl2 border border-border p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{dryRun.dryRunFilesToRestore ?? 0}</div>
          <div className="text-xs text-text3 mt-1">{t('recovery.mode.filesToRestore')}</div>
        </div>
        <div className="bg-panel rounded-xl2 border border-border p-4 text-center">
          <div className="text-2xl font-bold text-red-500">{dryRun.dryRunFilesToDelete ?? 0}</div>
          <div className="text-xs text-text3 mt-1">{t('recovery.mode.filesToDelete')}</div>
        </div>
        <div className="bg-panel rounded-xl2 border border-border p-4 text-center">
          <div className="text-2xl font-bold text-text2">{dryRun.dryRunFilesUnchanged ?? 0}</div>
          <div className="text-xs text-text3 mt-1">{t('recovery.mode.filesUnchanged')}</div>
        </div>
      </div>

      {dryRun.dryRunTotalBytes > 0 && (
        <div className="text-xs text-text3">
          {t('recovery.mode.totalDownload')}: <span className="font-semibold text-text1">{fmtBytes(dryRun.dryRunTotalBytes)}</span>
          {dryRun.estimatedDurationSeconds && (
            <span className="ml-3">{t('recovery.mode.estimatedTime')}: ~{Math.ceil(dryRun.estimatedDurationSeconds / 60)} min</span>
          )}
        </div>
      )}

      <FileList
        label={t('recovery.mode.filesToRestore')}
        files={dryRun.sampleRestore || []}
        color="bg-emerald-500"
      />
      <FileList
        label={t('recovery.mode.filesToDelete')}
        files={dryRun.sampleDelete || []}
        color="bg-red-500"
      />

      {dryRun.criticalProtected > 0 && (
        <div className="bg-accentLight border border-accent/20 rounded-xl2 p-3 text-xs">
          <span className="font-semibold text-accent">{dryRun.criticalProtected}</span>{' '}
          <span className="text-text2">{t('recovery.mode.criticalProtected')}</span>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          className="btn-primary text-sm py-2.5 px-6 font-semibold"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? t('recovery.mode.confirming') : t('recovery.mode.confirmRestore')}
        </button>
        <button
          className="btn-ghost text-sm py-2.5 px-4"
          onClick={onCancel}
          disabled={loading}
        >
          {t('recovery.common.cancel')}
        </button>
      </div>

      <div className="bg-surface rounded-lg p-3 border border-border/50">
        <label className="flex items-start gap-2 text-xs text-text2 cursor-pointer">
          <input type="checkbox" className="mt-0.5" required />
          <span>{t('recovery.mode.confirmCheckbox')}</span>
        </label>
      </div>
    </div>
  );
}
