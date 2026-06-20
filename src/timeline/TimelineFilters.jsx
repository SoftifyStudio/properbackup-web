import React from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

const FLAG_OPTIONS = [
  { key: 'all', labelKey: 'timeline.filterAll' },
  { key: 'A', labelKey: 'timeline.filterBackups' },
  { key: 'D', labelKey: 'timeline.filterDeleted' },
];

const TYPE_OPTIONS = [
  { key: 'all', labelKey: 'timeline.typeAll' },
  { key: 'AUTO', labelKey: 'timeline.typeAuto' },
  { key: 'MANUAL', labelKey: 'timeline.typeManual' },
  { key: 'TOMBSTONE', labelKey: 'timeline.typeTombstone' },
];

const STATUS_OPTIONS = [
  { key: 'all', labelKey: 'timeline.statusAll' },
  { key: 'IN_PROGRESS', labelKey: 'timeline.statusInProgress' },
  { key: 'SEALED', labelKey: 'timeline.statusSealed' },
  { key: 'FLUSHED', labelKey: 'timeline.statusFlushed' },
  { key: 'VERIFIED', labelKey: 'timeline.statusVerified' },
];

function FilterPills({ options, value, onChange }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-0.5 bg-surface rounded-lg p-0.5 border border-border/50">
      {options.map(({ key, labelKey }) => (
        <button
          key={key}
          className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium ${
            value === key ? 'bg-panel text-accent shadow-sm border border-accent/20' : 'text-text3 hover:text-text2'
          }`}
          onClick={() => onChange(key)}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}

export default function TimelineFilters({
  filterFlag, onFilterFlagChange,
  filterType, onFilterTypeChange,
  filterStatus, onFilterStatusChange,
  dateFrom, onDateFromChange,
  dateTo, onDateToChange,
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <div className="flex items-center flex-wrap gap-3">
        <FilterPills options={FLAG_OPTIONS} value={filterFlag} onChange={onFilterFlagChange} />
        <FilterPills options={TYPE_OPTIONS} value={filterType} onChange={onFilterTypeChange} />
        <FilterPills options={STATUS_OPTIONS} value={filterStatus} onChange={onFilterStatusChange} />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-text4">{t('timeline.dateRange')}:</span>
        <input
          type="date"
          className="input text-xs px-2 py-1 w-36"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
        />
        <span className="text-text4">–</span>
        <input
          type="date"
          className="input text-xs px-2 py-1 w-36"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
        />
        {(dateFrom || dateTo) && (
          <button
            className="text-xs text-accent hover:underline"
            onClick={() => { onDateFromChange(''); onDateToChange(''); }}
          >
            {t('timeline.clearDates')}
          </button>
        )}
      </div>
    </div>
  );
}
