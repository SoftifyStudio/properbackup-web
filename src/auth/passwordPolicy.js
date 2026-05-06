/** Matches {@code PasswordPolicy} in properbackup-buffer (registration). */

export const PASSWORD_MIN_LENGTH = 10;

const DEFS = [
  { id: 'len', test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'lower', test: (p) => /[a-z]/.test(p) },
  { id: 'upper', test: (p) => /[A-Z]/.test(p) },
  { id: 'digit', test: (p) => /[0-9]/.test(p) },
  { id: 'special', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/** @param {string} password */
/** @param {(id: string) => string} labelForId */
export function passwordChecks(password, labelForId) {
  const p = password ?? '';
  return DEFS.map((r) => ({ id: r.id, label: labelForId(r.id), ok: r.test(p) }));
}

export function isPasswordAcceptable(password) {
  const p = password ?? '';
  return DEFS.every((r) => r.test(p));
}

/** @param {(score: number) => string} strengthLabelForScore */
export function passwordStrengthMeta(password, labelForId, strengthLabelForScore) {
  const checks = passwordChecks(password, labelForId);
  const score = checks.filter((c) => c.ok).length;
  const text = strengthLabelForScore(score);
  return { checks, score, text };
}
