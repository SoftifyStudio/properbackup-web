/**
 * Playwright config for the backup-core full-pipeline E2E (test01).
 *
 * Runs INSIDE dedyk LXC 100 against the live stack (panel :80, buffer :8080).
 * Native video recording ALWAYS on — one .webm per test (proof artifact).
 * workers=1 — sequential, no recovery/seal race conditions.
 *
 * Usage (inside LXC 100):
 *   npx playwright test --config tests/e2e/playwright.backup-core.config.js
 */
import { defineConfig } from '@playwright/test';

const PANEL_URL = process.env.PB_PANEL_URL || 'http://127.0.0.1:80';

export default defineConfig({
  testDir: '.',
  testMatch: 'backup-core-e2e.spec.js',
  outputDir: 'test-results/backup-core',
  timeout: 240_000, // real agent backup + seal + restore + decrypt
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['html', { open: 'never', outputFolder: 'test-results/backup-core-report' }],
    ['list'],
  ],
  use: {
    baseURL: PANEL_URL,
    headless: true,
    video: 'on',
    screenshot: 'on',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'backup-core',
      use: { browserName: 'chromium' },
    },
  ],
});
