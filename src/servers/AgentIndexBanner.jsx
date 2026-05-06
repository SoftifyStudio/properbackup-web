import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

const STALE_MS = 15 * 60 * 1000;

/** Powoduje rerender co 1 s — pod „X s temu” bez ciężkiego pollingu. */
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

function IndexingProgressBar({ phase, loading }) {
  const indeterminate = loading || phase === 'indexing' || phase === 'uploading';
  const idle = phase === 'idle';
  const waiting = phase === 'waiting';

  return (
    <div
      className="relative h-2.5 w-full overflow-hidden rounded-full bg-border/90 ring-1 ring-border/50"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={indeterminate ? 'in progress' : idle ? 'ready' : waiting ? 'waiting' : 'pending'}
    >
      {indeterminate && (
        <div
          className="absolute inset-y-0 w-[38%] rounded-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-90 shadow-sm animate-agent-index-bar"
          style={{ willChange: 'transform' }}
        />
      )}
      {!indeterminate && idle && (
        <div className="h-full w-full rounded-full bg-gradient-to-r from-success/80 to-success/55 transition-all duration-500" />
      )}
      {!indeterminate && waiting && (
        <div className="h-full w-[24%] rounded-full bg-warn/55 animate-pulse" />
      )}
      {!indeterminate && !idle && !waiting && (
        <div className="h-full w-[10%] rounded-full bg-text4/30" />
      )}
    </div>
  );
}

/**
 * Karta stanu agenta (OneDrive-style): pasek postępu, ostatnia aktualizacja (odświeżana co 1 s), kompaktowe wiersze metadanych.
 */
export default function AgentIndexBanner({
  serverName,
  agentStatus,
  rootsCount,
  totalFiles,
  loading,
  variant = 'panel',
}) {
  const { t, formatDateTime } = useI18n();
  useRerenderEverySecond();

  const updatedAt = agentStatus?.updatedAt ? new Date(agentStatus.updatedAt) : null;
  const stale = updatedAt && Date.now() - updatedAt.getTime() > STALE_MS;

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
            >
              <path
                d="M12 4a7 7 0 00-6.93 6h2.02a5 5 0 015.91-4.9V4zM4 13h2a5 5 0 005 5v2a7 7 0 01-7-7zm16 0h2a7 7 0 01-7 7v-2a5 5 0 005-5zm0-5h2a7 7 0 00-7-7v2a5 5 0 015 5z"
                fill="currentColor"
                opacity=".92"
              />
              <path d="M12 9a3 3 0 100 6 3 3 0 000-6z" fill="currentColor" opacity=".35" />
            </svg>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className={`${titleClass} font-semibold text-text1 tracking-tight leading-tight`}>
                  {phaseLabel}
                </h2>
                {subtitle ? (
                  <p className="text-sm text-text3 leading-snug">{subtitle}</p>
                ) : null}
                <IndexingProgressBar phase={phase} loading={loading} />
                <p className="text-xs text-text4 tabular-nums">
                  {t('backups.agentIndexStats', { roots: rootsCount, files: totalFiles })}
                </p>
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
