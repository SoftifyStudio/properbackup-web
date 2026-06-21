/**
 * Playwright config for Recovery Mode E2E tests.
 *
 * Two modes:
 *   LIVE=1: runs against real deployed panel (OVH dedyk after DEPLOYED signal)
 *     npx playwright test --config tests/e2e/recovery/playwright.recovery.config.js
 *
 *   LIVE=0 (default): starts local Vite dev server, uses route interception for API mocks
 *     npx playwright test --config tests/e2e/recovery/playwright.recovery.config.js
 *
 * Video recording is ALWAYS on — captures full flow proof for PR comments.
 * Videos saved to: test-results/recovery-videos/
 */
import { defineConfig } from '@playwright/test';

const LIVE = process.env.LIVE === '1';
const BASE_URL = LIVE
  ? (process.env.PROPERBACKUP_PANEL_URL || 'http://51.255.93.127:80')
  : 'http://localhost:5173';

export default defineConfig({
  testDir: '.',
  outputDir: 'test-results/recovery-videos',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['html', { open: 'never', outputFolder: 'test-results/recovery-report' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
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
      name: 'recovery-chromium',
      use: { browserName: 'chromium' },
    },
  ],
  ...(LIVE ? {} : {
    webServer: {
      command: 'npm run dev -- --port 5173',
      port: 5173,
      cwd: process.cwd(),
      reuseExistingServer: true,
      timeout: 30_000,
    },
  }),
});
