import React from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

const STATUS_STYLES = {
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
  SEALED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  FLUSHED: 'bg-purple-100 text-purple-700 border-purple-200',
  VERIFIED: 'bg-teal-100 text-teal-700 border-teal-200',
};

const STATUS_DOTS = {
  IN_PROGRESS: 'bg-blue-500 animate-pulse',
  SEALED: 'bg-emerald-500',
  FLUSHED: 'bg-purple-500',
  VERIFIED: 'bg-teal-500',
};

function deriveStatus(snap) {
  if (snap.status) return snap.status;
  if (snap.verifiedAt) return 'VERIFIED';
  if (snap.flushedAt) return 'FLUSHED';
  if (snap.sealedAt) return 'SEALED';
  return 'IN_PROGRESS';
}

export { deriveStatus };

export default function SnapshotStatusBadge({ snapshot }) {
  const { t } = useI18n();
  const status = deriveStatus(snapshot);
  const style = STATUS_STYLES[status] || STATUS_STYLES.SEALED;
  const dot = STATUS_DOTS[status] || STATUS_DOTS.SEALED;

  const labelKeys = {
    IN_PROGRESS: 'timeline.statusInProgress',
    SEALED: 'timeline.statusSealed',
    FLUSHED: 'timeline.statusFlushed',
    VERIFIED: 'timeline.statusVerified',
  };

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {t(labelKeys[status] || labelKeys.SEALED)}
    </span>
  );
}
