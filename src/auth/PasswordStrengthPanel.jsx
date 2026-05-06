import React from 'react';
import { PASSWORD_MIN_LENGTH, isPasswordAcceptable, passwordStrengthMeta } from './passwordPolicy.js';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function PasswordStrengthPanel({ value }) {
  const { t } = useI18n();

  const labelForId = (id) =>
    id === 'len' ? t('password.rules.len', { min: PASSWORD_MIN_LENGTH }) : t(`password.rules.${id}`);
  const strengthForScore = (score) => t(`password.strength.${Math.min(5, Math.max(0, score))}`);

  const { checks, score, text } = passwordStrengthMeta(value, labelForId, strengthForScore);
  const allOk = isPasswordAcceptable(value);

  return (
    <div className="mt-3 space-y-3" aria-live="polite">
      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={score}
        aria-label={`${t('password.passwordStrengthAria')}: ${score} / 5`}
      >
        {checks.map((c) => (
          <div
            key={c.id}
            title={c.label}
            className={`flex-1 h-2.5 rounded-md transition-all duration-300 ease-out ${
              c.ok ? 'bg-success shadow-sm' : 'bg-border'
            }`}
          />
        ))}
      </div>
      <p
        className={`text-xs font-semibold transition-colors duration-200 ${
          allOk ? 'text-success' : score >= 3 ? 'text-warn' : 'text-danger'
        }`}
      >
        {text}
        {!allOk && score > 0 && <span className="font-normal text-text3"> {t('password.meetAllSuffix')}</span>}
      </p>
      <ul className="space-y-1.5 text-[11px] leading-snug border-t border-border/70 pt-3">
        {checks.map((c) => (
          <li
            key={c.id}
            className={`flex items-start gap-2 transition-colors duration-200 ${
              c.ok ? 'text-success' : 'text-text4'
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold ${
                c.ok ? 'border-success bg-successLight' : 'border-border bg-surface text-text4'
              }`}
              aria-hidden="true"
            >
              {c.ok ? '✓' : ''}
            </span>
            <span>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
