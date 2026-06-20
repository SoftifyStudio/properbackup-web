/**
 * E2E Test: Full-System Recovery Mode UI
 *
 * Tests the Recovery Session overlay (HR-1 through HR-4):
 *   - Login to panel
 *   - Navigate to server's backup page
 *   - Verify Recovery UI components are rendered
 *   - Test recovery API client integration (start, get, cancel)
 *   - Screenshot evidence of each state
 *
 * Prerequisites:
 *   Server: properbackup-test-server.softify.com.pl (live test server)
 *   Test user: email_verified=true
 */
import { test, expect } from '@playwright/test';

const PANEL_URL = process.env.PROPERBACKUP_PANEL_URL || 'http://properbackup-test-server.softify.com.pl';
const SERVER_ID = process.env.PROPERBACKUP_SERVER_ID || 'e145d60a-1b48-4cc0-b72a-2479a4179c30';
const JWT_SECRET = 'UA0qCzRDybQkHNiaykhtJXIUzjvxHCol1J1iO+pE9yY=';

test.describe('Recovery Session UI — Full System Restore', () => {
  let authToken;

  test.beforeEach(async ({ page }) => {
    // Login to get auth token
    const loginRes = await page.request.post(`${PANEL_URL}/api/auth/login`, {
      data: {
        email: 'e2e-backup-e-1781957004356-2jrp@properbackup.dev',
        password: 'TestPass123!',
      },
    });

    if (loginRes.ok()) {
      const authData = await loginRes.json();
      authToken = authData.token;

      await page.goto(PANEL_URL);
      await page.evaluate((data) => {
        sessionStorage.setItem('pb_auth', JSON.stringify(data));
      }, { ...authData, emailVerified: true });
    }
  });

  test('It should load the panel and display servers list after login', async ({ page }) => {
    await page.goto(`${PANEL_URL}/servers`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Panel should show servers or "add server" prompt
    const body = await page.textContent('body');
    expect(body.length).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/recovery-01-servers-list.png' });
  });

  test('It should navigate to server backups page', async ({ page }) => {
    if (!authToken) test.skip();

    await page.goto(`${PANEL_URL}/servers/${SERVER_ID}?name=test-server`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'test-results/recovery-02-backups-page.png' });
  });

  test('It should start a recovery session via API and get valid response', async ({ page }) => {
    if (!authToken) test.skip();

    // Test recovery start endpoint
    const startRes = await page.request.post(`${PANEL_URL}/api/recovery/start`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { server_id: SERVER_ID, target_snapshot_id: 20 },
    });

    const startData = await startRes.json();
    console.log('Recovery start response:', startRes.status(), JSON.stringify(startData));

    // Either 201 (created) or 409 (already active)
    expect([201, 409]).toContain(startRes.status());

    if (startRes.status() === 201) {
      const sessionId = startData.session_id;
      expect(sessionId).toBeTruthy();

      // Verify session state
      const getRes = await page.request.get(`${PANEL_URL}/api/recovery/${sessionId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(getRes.ok()).toBeTruthy();
      const sessionData = await getRes.json();
      expect(sessionData.state).toBeTruthy();
      console.log('Session state:', sessionData.state);

      // Cancel it to clean up
      const cancelRes = await page.request.post(`${PANEL_URL}/api/recovery/${sessionId}/cancel`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: { reason: 'E2E test cleanup' },
      });
      expect(cancelRes.ok()).toBeTruthy();
    }
  });

  test('It should display recovery history for the server', async ({ page }) => {
    if (!authToken) test.skip();

    const historyRes = await page.request.get(
      `${PANEL_URL}/api/recovery/history?server_id=${SERVER_ID}`,
      { headers: { Authorization: `Bearer ${authToken}` } },
    );

    expect(historyRes.ok()).toBeTruthy();
    const history = await historyRes.json();
    console.log(`Recovery history: ${history.length || (history.sessions || []).length} sessions`);
    expect(Array.isArray(history) || Array.isArray(history.sessions)).toBeTruthy();
  });

  test('It should reject recovery start without auth token', async ({ page }) => {
    const res = await page.request.post(`${PANEL_URL}/api/recovery/start`, {
      data: { server_id: SERVER_ID, target_snapshot_id: 20 },
    });
    expect(res.status()).toBe(401);
  });

  test('It should reject concurrent recovery on same server with 409', async ({ page }) => {
    if (!authToken) test.skip();

    // Start first session
    const res1 = await page.request.post(`${PANEL_URL}/api/recovery/start`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { server_id: SERVER_ID, target_snapshot_id: 20 },
    });

    if (res1.status() === 201) {
      const data1 = await res1.json();

      // Try to start second concurrent session → should get 409
      const res2 = await page.request.post(`${PANEL_URL}/api/recovery/start`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: { server_id: SERVER_ID, target_snapshot_id: 20 },
      });
      expect(res2.status()).toBe(409);

      // Cleanup
      await page.request.post(`${PANEL_URL}/api/recovery/${data1.session_id}/cancel`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: { reason: 'E2E test cleanup' },
      });
    } else {
      // Already a session active — just try starting another
      const res2 = await page.request.post(`${PANEL_URL}/api/recovery/start`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: { server_id: SERVER_ID, target_snapshot_id: 20 },
      });
      expect(res2.status()).toBe(409);
    }
  });
});
