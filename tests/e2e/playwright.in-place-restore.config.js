import { defineConfig } from '@playwright/test';

/**
 * Dedicated config for test02 (in-place restore). Isolated so it does not run
 * the older "download & decrypt" specs. video:'on', workers=1 (anti-flake).
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'in-place-restore-e2e.spec.js',
  outputDir: '../../test-results/in-place-restore',
  timeout: 420_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../../playwright-report/in-place-restore' }]],
  use: {
    baseURL: process.env.PROPERBACKUP_PANEL_URL || 'http://51.255.93.127',
    headless: true,
    viewport: { width: 1366, height: 900 },
    video: 'on',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
