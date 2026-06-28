/**
 * Playwright config for the UI-DRIVEN backup-core restore E2E (test01-ui).
 *
 * Same live target as the API-driven test01 (dedyk LXC 100: panel :80, buffer :8080),
 * but the RESTORE is driven entirely through the panel UI (form login → servers →
 * Timeline → Restore wizard → on-screen confirmation) so the native .webm is an
 * actual, human-watchable proof of the product working — not a blank window.
 *
 * Native video ALWAYS on — one .webm per test. workers=1 (no seal/recovery races).
 *
 * Usage (inside LXC 100):
 *   npx playwright test --config tests/e2e/playwright.backup-core-ui.config.js
 */
import { defineConfig } from '@playwright/test';

const PANEL_URL = process.env.PB_PANEL_URL || 'http://127.0.0.1:80';

export default defineConfig({
  testDir: '.',
  testMatch: 'backup-core-ui-e2e.spec.js',
  outputDir: 'test-results/backup-core-ui',
  timeout: 300_000, // real agent backup + seal + UI navigation + thaw + decrypt
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['html', { open: 'never', outputFolder: 'test-results/backup-core-ui-report' }],
    ['list'],
  ],
  use: {
    baseURL: PANEL_URL,
    headless: true,
    video: 'on',
    screenshot: 'on',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'backup-core-ui',
      use: { browserName: 'chromium' },
    },
  ],
});
