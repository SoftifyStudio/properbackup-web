import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

const STALE_MS = 15 * 60 * 1000;

function useRerenderEverySecond() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
}

function relativeUpdatedLabel(iso, t) {
  if (!iso) return t('backups.agentNeverConnected');
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  if (ms < 0) return t('common.relativeJustNow');
  const sec = Math.floor(ms / 1000);
  if (sec < 8) return t('common.relativeJustNow');
  if (sec < 60) return t('common.relativeSecondsAgo', { count: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return t('common.relativeMinutesAgo', { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 48) return t('common.relativeHoursAgo', { count: hr });
  const day = Math.floor(hr / 24);
  return t('common.relativeDaysAgo', { count: day });
}

const VerificationBadge = React.memo(function VerificationBadge({ verification, t }) {
  if (!verification) return null;
  const timeLabel = relativeUpdatedLabel(verification.verifiedAt, t);
  if (verification.status === 'passed') {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" clipRule="evenodd"/>
          </svg>
          Verified
        </span>
        <span className="text-[10px] text-text4">{timeLabel}</span>
      </div>
    );
  }
  if (verification.status === 'failed') {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M4.28 3.22a.75.75 0 00-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 101.06 1.06L8 9.06l3.72 3.72a.75.75 0 101.06-1.06L9.06 8l3.72-3.72a.75.75 0 00-1.06-1.06L8 6.94 4.28 3.22z" clipRule="evenodd"/>
          </svg>
          Verification Failed
        </span>
        <span className="text-[10px] text-text4">{timeLabel}</span>
      </div>
    );
  }
  return null;
});

const IndexingProgressBar = React.memo(function IndexingProgressBar({ phase, loading, totalFiles, scannedFiles }) {
  const hasDeterminate = phase === 'indexing'
    && typeof totalFiles === 'number' && totalFiles > 0
    && typeof scannedFiles === 'number';
  const pct = hasDeterminate ? Math.min(100, Math.round((scannedFiles / totalFiles) * 100)) : 0;

  const indeterminate = !hasDeterminate && (loading || phase === 'indexing' || phase === 'uploading');
  const idle = phase === 'idle';
  const waiting = phase === 'waiting';
  const uploading = !hasDeterminate && phase === 'uploading';

  return (
    <div
      className="relative h-2.5 w-full overflow-hidden rounded-full bg-border/90 ring-1 ring-border/50"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={hasDeterminate ? pct : undefined}
      aria-valuetext={hasDeterminate ? `${pct}%` : indeterminate ? 'in progress' : idle ? 'ready' : waiting ? 'waiting' : 'pending'}
    >
      {hasDeterminate && (
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent/80 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      )}
      {(indeterminate || uploading) && (
        <div
          className="absolute inset-y-0 w-[38%] rounded-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-90 shadow-sm animate-agent-index-bar"
          style={{ willChange: 'transform' }}
        />
      )}
      {!hasDeterminate && !indeterminate && !uploading && idle && (
        <div className="h-full w-full rounded-full bg-gradient-to-r from-success/80 to-success/55 transition-all duration-500" />
      )}
      {!hasDeterminate && !indeterminate && !uploading && waiting && (
        <div className="h-full w-[24%] rounded-full bg-warn/55 animate-pulse" />
      )}
      {!hasDeterminate && !indeterminate && !uploading && !idle && !waiting && (
        <div className="h-full w-[10%] rounded-full bg-text4/30" />
      )}
    </div>
  );
});

/**
 * Karta stanu agenta (macOS Tahoe / Spotlight style):
 * pasek postępu (determinate gdy agent raportuje totalFiles/scannedFiles),
 * aktualny plik, ostatnia aktualizacja co 1 s, kompaktowe wiersze metadanych.
 */
export default function AgentIndexBanner({
  serverName,
  agentStatus,
  rootsCount,
  totalFiles,
  latestVerification,
  loading,
  variant = 'panel',
}) {
  const { t, formatDateTime } = useI18n();
  useRerenderEverySecond();

  const updatedAt = agentStatus?.updatedAt ? new Date(agentStatus.updatedAt) : null;
  const stale = updatedAt && Date.now() - updatedAt.getTime() > STALE_MS;

  const agentTotalFiles = agentStatus?.totalFiles;
  const agentScannedFiles = agentStatus?.scannedFiles;
  const agentCurrentFile = agentStatus?.currentFile;

  const hasDeterminateProgress = agentStatus?.phase === 'indexing'
    && typeof agentTotalFiles === 'number' && agentTotalFiles > 0
    && typeof agentScannedFiles === 'number';

  const pct = hasDeterminateProgress
    ? Math.min(100, Math.round((agentScannedFiles / agentTotalFiles) * 100))
    : null;

  const derivedSubtitle = useMemo(() => {
    if (loading) return t('backups.agentDerivedLoading');
    if (agentStatus?.detail) return null;
    if (!agentStatus && rootsCount === 0 && totalFiles === 0) {
      return t('backups.agentDerivedNoSignal');
    }
    if (!agentStatus && rootsCount > 0 && totalFiles === 0) {
      return t('backups.agentDerivedRootsNoFiles');
    }
    if (!agentStatus && totalFiles > 0) return t('backups.agentDerivedHasFilesNoTelemetry');
    return null;
  }, [loading, agentStatus, rootsCount, totalFiles, t]);

  const phase = agentStatus?.phase ?? 'unknown';
  const phaseKey = `backups.agentPhase.${phase}`;
  const phaseTranslated = t(phaseKey);
  const phaseLabel = phaseTranslated === phaseKey ? phase : phaseTranslated;
  const subtitle = agentStatus?.detail ?? derivedSubtitle ?? '';

  const progressLabel = hasDeterminateProgress
    ? t('backups.agentProgressCount', {
        scanned: agentScannedFiles.toLocaleString(),
        total: agentTotalFiles.toLocaleString(),
        pct,
      })
    : null;

  const relative = relativeUpdatedLabel(agentStatus?.updatedAt, t);
  const absolute = agentStatus?.updatedAt
    ? formatDateTime(agentStatus.updatedAt, { dateStyle: 'medium', timeStyle: 'medium' })
    : t('common.dash');

  const isSpotlight = variant === 'spotlight';
  const titleClass = isSpotlight ? 'text-xl sm:text-2xl' : 'text-lg';

  return (
    <div
      className={
        isSpotlight
          ? 'rounded-xl2 border border-border bg-panel shadow-card overflow-hidden'
          : 'rounded-xl2 border border-border bg-panel overflow-hidden'
      }
    >
      <div
        className={
          isSpotlight
            ? 'px-5 py-5 sm:px-7 sm:py-6 bg-gradient-to-b from-panel to-surface/80'
            : 'px-4 py-4 sm:px-5 sm:py-4'
        }
      >
        <div className="flex gap-4 sm:gap-5">
          <div
            className={`shrink-0 rounded-xl2 bg-accentLight flex items-center justify-center shadow-inner ${
              isSpotlight ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-10 h-10'
            }`}
            aria-hidden
          >
            <svg
              className={isSpotlight ? 'w-6 h-6 sm:w-7 sm:h-7 text-accent' : 'w-5 h-5 text-accent'}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
              <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
              <path d="M3 8v0" opacity=".3" />
            </svg>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-baseline gap-3">
                  <h2 className={`${titleClass} font-semibold text-text1 tracking-tight leading-tight`}>
                    {phaseLabel}
                  </h2>
                  {pct != null && (
                    <span className="text-sm font-semibold text-accent tabular-nums">{pct}%</span>
                  )}
                </div>
                {subtitle ? (
                  <p className="text-sm text-text3 leading-snug">{subtitle}</p>
                ) : null}
                <IndexingProgressBar
                  phase={phase}
                  loading={loading}
                  totalFiles={agentTotalFiles}
                  scannedFiles={agentScannedFiles}
                />
                <div className="space-y-0.5">
                  {progressLabel && (
                    <p className="text-xs text-text3 tabular-nums">{progressLabel}</p>
                  )}
                  {agentCurrentFile && phase === 'indexing' && (
                    <p className="text-[11px] text-text4 font-mono truncate max-w-sm" title={agentCurrentFile}>
                      {agentCurrentFile}
                    </p>
                  )}
                  <p className="text-xs text-text4 tabular-nums">
                    {t('backups.agentIndexStats', { roots: rootsCount, files: totalFiles })}
                  </p>
                  <VerificationBadge verification={latestVerification} t={t} />
                </div>
              </div>

              <div className="shrink-0 lg:text-right lg:pl-6 lg:ml-2 lg:border-l lg:border-border/70 space-y-0.5">
                <p className="text-[10px] uppercase tracking-wider text-text4 font-semibold">
                  {t('backups.agentLastSignal')}
                </p>
                <p className="text-base font-semibold text-text2 tabular-nums leading-tight">{relative}</p>
                <p className="text-xs text-text4 tabular-nums">{absolute}</p>
                {stale && agentStatus?.updatedAt ? (
                  <p className="text-[11px] text-warn pt-1 max-w-[14rem] lg:ml-auto">
                    {t('backups.agentStaleWarning', { time: formatDateTime(agentStatus.updatedAt) })}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border/70 bg-surface/40 px-5 py-2 sm:px-7">
        <span className="text-xs text-text4">{t('backups.serverDisplayName')}:</span>{' '}
        <span className="text-sm text-text2 font-medium">{serverName}</span>
      </div>
    </div>
  );
}
