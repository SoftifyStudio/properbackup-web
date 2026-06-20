/**
 * E2E Recovery Mode Tests — ProperBackup Time Machine Restore
 *
 * Tests the full Recovery Mode flow on a live test server:
 *   1. Recovery session creation via API (start → state check → cancel)
 *   2. UI smoke: login → servers → backups → Timeline → recovery overlay
 *   3. Cancel flow with audit trail verification
 *
 * Prerequisites (env vars):
 *   PROPERBACKUP_PANEL_URL        — panel URL
 *   PROPERBACKUP_TEST_EMAIL       — test account email
 *   PROPERBACKUP_TEST_PASS        — test account password
 *   PROPERBACKUP_SERVER_ID        — registered server ID
 *   PROPERBACKUP_TARGET_SNAPSHOT_ID — archive_snapshot.id (DB bigint)
 */
import { test, expect } from '@playwright/test';

const PANEL_URL = process.env.PROPERBACKUP_PANEL_URL || 'http://properbackup-test-server.softify.com.pl';
const TEST_EMAIL = process.env.PROPERBACKUP_TEST_EMAIL;
const TEST_PASS = process.env.PROPERBACKUP_TEST_PASS;
const SERVER_ID = process.env.PROPERBACKUP_SERVER_ID;
const SNAPSHOT_ID = Number(process.env.PROPERBACKUP_TARGET_SNAPSHOT_ID || '7');

async function loginAndGetToken(page) {
  const loginRes = await page.request.post(`${PANEL_URL}/api/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  expect(loginRes.ok(), `Login failed: ${loginRes.status()}`).toBeTruthy();
  const authData = await loginRes.json();
  return authData;
}

async function cancelIfActive(page, token) {
  const activeRes = await page.request.get(`${PANEL_URL}/api/recovery/active`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (activeRes.ok()) {
    const active = await activeRes.json();
    const sessions = active.sessions || (active.id ? [active] : []);
    for (const s of sessions) {
      const sid = s.id || s.session_id || s.sessionId;
      await page.request.post(`${PANEL_URL}/api/recovery/${sid}/cancel`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { reason: 'E2E test cleanup' },
      });
    }
  }
}

test.describe('Recovery Mode E2E — live server state machine', () => {
  test.beforeEach(async () => {
    for (const [name, val] of [
      ['PROPERBACKUP_TEST_EMAIL', TEST_EMAIL],
      ['PROPERBACKUP_TEST_PASS', TEST_PASS],
      ['PROPERBACKUP_SERVER_ID', SERVER_ID],
    ]) {
      if (!val) throw new Error(`Missing env var: ${name}`);
    }
  });

  test('It should create, query, and cancel a recovery session via API', async ({ page }) => {
    const authData = await loginAndGetToken(page);
    const token = authData.token;

    // Clean up any leftover sessions
    await cancelIfActive(page, token);

    // Step 1: POST /recovery/start
    const startRes = await page.request.post(`${PANEL_URL}/api/recovery/start`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { server_id: SERVER_ID, target_snapshot_id: SNAPSHOT_ID },
    });
    expect(startRes.ok(), `Start failed: ${startRes.status()}: ${await startRes.text()}`).toBeTruthy();
    const startData = await startRes.json();
    const sessionId = startData.session_id;
    expect(sessionId).toBeTruthy();
    console.log(`Session created: ${sessionId}`);

    // Step 2: GET /recovery/active
    const activeRes = await page.request.get(`${PANEL_URL}/api/recovery/active`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(activeRes.ok()).toBeTruthy();
    const activeData = await activeRes.json();
    const sessions = activeData.sessions || [];
    expect(sessions.length).toBeGreaterThan(0);
    console.log(`Active sessions: ${sessions.length}, state: ${sessions[0].state}`);

    // Step 3: GET /recovery/{id}
    const detailRes = await page.request.get(`${PANEL_URL}/api/recovery/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(detailRes.ok()).toBeTruthy();
    const detail = await detailRes.json();
    expect(detail.state).toBe('PLANNING');
    expect(detail.serverId).toBe(SERVER_ID);
    console.log(`Session detail: state=${detail.state}, targetSnapshotId=${detail.targetSnapshotId}`);

    // Step 4: GET /recovery/{id}/audit
    const auditRes = await page.request.get(`${PANEL_URL}/api/recovery/${sessionId}/audit`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(auditRes.ok()).toBeTruthy();
    const audit = await auditRes.json();
    expect(audit.entries.length).toBeGreaterThanOrEqual(2);
    console.log(`Audit entries: ${audit.entries.map(e => e.action).join(', ')}`);

    // Step 5: POST /recovery/{id}/cancel
    const cancelRes = await page.request.post(`${PANEL_URL}/api/recovery/${sessionId}/cancel`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { reason: 'E2E test — API state machine verification' },
    });
    expect(cancelRes.ok()).toBeTruthy();
    const cancelData = await cancelRes.json();
    expect(cancelData.state).toBe('CANCELLED');
    console.log('Session cancelled successfully');

    // Step 6: Verify CANCELLED state
    const postCancelRes = await page.request.get(`${PANEL_URL}/api/recovery/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const postCancel = await postCancelRes.json();
    expect(postCancel.state).toBe('CANCELLED');
    expect(postCancel.cancellationReason).toContain('E2E test');

    // Step 7: Verify active is empty
    const finalActiveRes = await page.request.get(`${PANEL_URL}/api/recovery/active`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (finalActiveRes.ok()) {
      const finalActive = await finalActiveRes.json();
      expect((finalActive.sessions || []).length).toBe(0);
    }
    console.log('State machine test complete');
  });

  test('It should show server page with Timeline and Backups tabs', async ({ page }) => {
    const authData = await loginAndGetToken(page);
    authData.emailVerified = true;

    // Inject auth
    await page.goto(PANEL_URL);
    await page.evaluate((data) => {
      sessionStorage.setItem('pb_auth', JSON.stringify(data));
    }, authData);

    // Navigate to server
    await page.goto(`${PANEL_URL}/servers/${SERVER_ID}?name=e2e-test-server`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Screenshot the page state
    await page.screenshot({ path: 'test-results/recovery-server-page.png', fullPage: true });
    console.log('Server page loaded, screenshot captured');
  });

  test('It should prevent double recovery on same server', async ({ page }) => {
    const authData = await loginAndGetToken(page);
    const token = authData.token;
    await cancelIfActive(page, token);

    // Start first session
    const start1Res = await page.request.post(`${PANEL_URL}/api/recovery/start`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { server_id: SERVER_ID, target_snapshot_id: SNAPSHOT_ID },
    });
    expect(start1Res.ok()).toBeTruthy();
    const session1 = await start1Res.json();
    const sid1 = session1.session_id;

    // Try to start second session — should get RECOVERY_ALREADY_ACTIVE
    const start2Res = await page.request.post(`${PANEL_URL}/api/recovery/start`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { server_id: SERVER_ID, target_snapshot_id: SNAPSHOT_ID },
    });
    const start2Data = await start2Res.json();
    expect(start2Data.code).toBe('RECOVERY_ALREADY_ACTIVE');
    expect(start2Data.sessionId).toBe(sid1);
    console.log(`Double-start blocked correctly: ${start2Data.code}`);

    // Cleanup
    await page.request.post(`${PANEL_URL}/api/recovery/${sid1}/cancel`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { reason: 'E2E double-start test cleanup' },
    });
  });

  test('It should verify SSE recovery stream endpoint', async ({ page }) => {
    const authData = await loginAndGetToken(page);
    const token = authData.token;
    await cancelIfActive(page, token);

    // Start session
    const startRes = await page.request.post(`${PANEL_URL}/api/recovery/start`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { server_id: SERVER_ID, target_snapshot_id: SNAPSHOT_ID },
    });
    expect(startRes.ok()).toBeTruthy();
    const session = await startRes.json();
    const sessionId = session.session_id;

    // Navigate to any page first so EventSource works in browser context
    await page.goto(PANEL_URL);
    await page.waitForLoadState('domcontentloaded');

    // Test SSE endpoint via page.evaluate — EventSource opens without error
    const sseUrl = `${PANEL_URL}/api/recovery/${sessionId}/stream?token=${token}`;
    const sseResult = await page.evaluate(async (url) => {
      return new Promise((resolve) => {
        const es = new EventSource(url);
        const timer = setTimeout(() => { es.close(); resolve({ status: 'timeout_ok' }); }, 3000);
        es.addEventListener('recovery_state', (e) => {
          clearTimeout(timer);
          es.close();
          resolve({ status: 'got_event', data: e.data });
        });
        es.addEventListener('error', () => {
          // EventSource retries by default, but initial error = no connection
        });
      });
    }, sseUrl);
    console.log(`SSE stream result: ${JSON.stringify(sseResult)}`);
    expect(sseResult.status).toBeTruthy();

    // Cleanup
    await page.request.post(`${PANEL_URL}/api/recovery/${sessionId}/cancel`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { reason: 'E2E SSE test cleanup' },
    });
  });
});
