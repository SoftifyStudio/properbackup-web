/**
 * Playwright config for Recovery Mode QA E2E suite.
 *
 * Runs against LIVE dedyk (51.255.93.127) — no mocks, no local dev server.
 * Video recording ALWAYS on — captures proof for every test.
 * Workers=1 — sequential to avoid recovery session race conditions.
 *
 * Usage:
 *   npx playwright test --config tests/e2e/playwright.recovery-qa.config.js
 */
import { defineConfig } from '@playwright/test';

const DEDYK_HOST = process.env.DEDYK_HOST || '51.255.93.127';

export default defineConfig({
  testDir: '.',
  testMatch: 'group-i-recovery.spec.js',
  outputDir: 'test-results/recovery-qa',
  timeout: 180_000, // 3min — test13/test18 trigger real agent (restore + poll)
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['html', { open: 'never', outputFolder: 'test-results/recovery-qa-report' }],
    ['list'],
  ],
  use: {
    baseURL: `http://${DEDYK_HOST}:80`,
    headless: true,
    video: 'on',
    screenshot: 'on',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'recovery-qa',
      use: { browserName: 'chromium' },
    },
  ],
});
