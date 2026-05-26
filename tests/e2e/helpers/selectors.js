/**
 * Bilingual selectors — all test text matches both EN and PL.
 */

export const SEL = {
  trialBanner: 'text=/Provide a payment card|Podaj kartę płatniczą/',
  trialButton: 'button:has-text("Start free"), button:has-text("Rozpocznij darmowy")',
  cancelButton: 'button:has-text("Cancel"), button:has-text("Anuluj")',
  renewButton: 'button:has-text("Renew"), button:has-text("Odnów")',
  payButton: 'button:has-text("Select & pay"), button:has-text("Wybierz i zapłać")',
  annualTab: 'button:has-text("Annual"), button:has-text("Roczny")',
  monthlyTab: 'button:has-text("Monthly"), button:has-text("Miesięczny")',
  consentCheckbox: 'input[type="checkbox"]',
};
