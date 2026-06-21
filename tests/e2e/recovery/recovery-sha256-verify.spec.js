/**
 * Recovery E2E — Full SHA-256 Verification (post-DEPLOYED)
 *
 * This test runs the COMPLETE recovery flow on the live OVH dedyk:
 *   1. Login → select snapshot → start recovery
 *   2. DRY RUN → confirm
 *   3. Wait for AGENT_RESTORING → DONE
 *   4. SSH into LXC and verify SHA-256 hashes of restored files match originals
 *
 * This is the MAIN moment of truth — proves recovery integrity end-to-end.
 *
 * Required env vars (LIVE mode only):
 *   PROPERBACKUP_PANEL_URL       — panel URL (http://51.255.93.127:80)
 *   PROPERBACKUP_BUFFER_URL      — buffer URL (http://51.255.93.127:8080)
 *   PROPERBACKUP_TEST_EMAIL      — login email
 *   PROPERBACKUP_TEST_PASS       — login password
 *   PROPERBACKUP_SERVER_ID       — target server ID
 *   PROPERBACKUP_SNAPSHOT_ID     — snapshot to restore
 *   PROPERBACKUP_ORIGINAL_SHA256 — expected SHA-256 of a known file (comma-separated: path:hash pairs)
 *   OVH_DEDICATED_SERVER_PROXMOX_ROOT_PASSWORD — SSH password for verification
 */
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const PANEL_URL = process.env.PROPERBACKUP_PANEL_URL || 'http://51.255.93.127:80';
const BUFFER_URL = process.env.PROPERBACKUP_BUFFER_URL || 'http://51.255.93.127:8080';
const TEST_EMAIL = process.env.PROPERBACKUP_TEST_EMAIL;
const TEST_PASS = process.env.PROPERBACKUP_TEST_PASS;
const SERVER_ID = process.env.PROPERBACKUP_SERVER_ID;
const SNAPSHOT_ID = process.env.PROPERBACKUP_SNAPSHOT_ID;
const ORIGINAL_HASHES = process.env.PROPERBACKUP_ORIGINAL_SHA256 || '';
const SSH_PASS = process.env.OVH_DEDICATED_SERVER_PROXMOX_ROOT_PASSWORD;

test.describe('Recovery E2E — Full flow + SHA-256 hash match (LIVE)', () => {
  test.skip(!TEST_EMAIL || !TEST_PASS || !SERVER_ID, 'Missing required env vars for live E2E');

  let authToken;

  test.beforeAll(async ({ request }) => {
    // Authenticate
    const loginRes = await request.post(`${PANEL_URL}/api/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    expect(loginRes.ok(), `Login failed: ${loginRes.status()}`).toBeTruthy();
    const authData = await loginRes.json();
    authToken = authData.token;
  });

  test('Full recovery flow: start → DRY RUN → confirm → restore → SHA-256 verify', async ({ page }) => {
    // ── Step 1: Start recovery via API ──
    console.log(`Starting recovery for server ${SERVER_ID}, snapshot ${SNAPSHOT_ID}`);
    const startRes = await page.request.post(`${BUFFER_URL}/recovery/start`, {
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      data: { server_id: SERVER_ID, target_snapshot_id: SNAPSHOT_ID },
    });
    expect(startRes.ok(), `Start recovery failed: ${startRes.status()}`).toBeTruthy();
    const { session_id } = await startRes.json();
    console.log(`Recovery session created: ${session_id}`);

    // ── Step 2: Wait for PLANNING → AWAITING_USER_CONFIRM ──
    let session;
    for (let i = 0; i < 60; i++) {
      const res = await page.request.get(`${BUFFER_URL}/recovery/${session_id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      session = await res.json();
      console.log(`  Poll ${i}: state=${session.state}`);
      if (session.state === 'AWAITING_USER_CONFIRM') break;
      if (session.state === 'FAILED') throw new Error(`Recovery failed in PLANNING: ${session.failureReason}`);
      await page.waitForTimeout(2000);
    }
    expect(session.state).toBe('AWAITING_USER_CONFIRM');
    console.log(`DRY RUN results: restore=${session.dryRunFilesToRestore}, delete=${session.dryRunFilesToDelete}, unchanged=${session.dryRunFilesUnchanged}`);

    // ── Step 3: Confirm recovery (cold_tier: false → instant READY) ──
    const confirmRes = await page.request.post(`${BUFFER_URL}/recovery/${session_id}/confirm`, {
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      data: { user_confirmation: true, cold_tier: false },
    });
    expect(confirmRes.ok(), `Confirm failed: ${confirmRes.status()}`).toBeTruthy();
    console.log('Recovery confirmed — cold_tier: false → should go READY immediately (no THAWING)');

    // ── Step 4: Verify THAWING is skipped (→ READY directly) ──
    const postConfirmRes = await page.request.get(`${BUFFER_URL}/recovery/${session_id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const postConfirm = await postConfirmRes.json();
    console.log(`Post-confirm state: ${postConfirm.state}`);
    // CRITICAL: must be READY, not THAWING
    expect(postConfirm.state).not.toBe('THAWING');
    expect(['READY', 'AGENT_RESTORING']).toContain(postConfirm.state);

    // ── Step 5: Wait for AGENT_RESTORING → DONE ──
    let finalState;
    const startTime = Date.now();
    for (let i = 0; i < 300; i++) { // max 10 min
      const res = await page.request.get(`${BUFFER_URL}/recovery/${session_id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      finalState = await res.json();
      if (['DONE', 'FAILED', 'CANCELLED'].includes(finalState.state)) break;
      if (i % 10 === 0) {
        const pct = finalState.dryRunFilesToRestore > 0
          ? Math.round(((finalState.filesRestored || 0) / finalState.dryRunFilesToRestore) * 100)
          : 0;
        console.log(`  Progress: state=${finalState.state}, ${pct}% (${finalState.filesRestored}/${finalState.dryRunFilesToRestore})`);
      }
      await page.waitForTimeout(2000);
    }
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`Recovery finished in ${elapsed}s: state=${finalState.state}`);
    expect(finalState.state).toBe('DONE');
    console.log(`Final: restored=${finalState.filesRestored}, deleted=${finalState.filesDeleted}, bytes=${finalState.bytesTransferred}`);

    // ── Step 6: SHA-256 verification via SSH into LXC ──
    if (ORIGINAL_HASHES && SSH_PASS) {
      console.log('\n=== SHA-256 Hash Verification (on LXC) ===');
      // Parse expected hashes: "path1:hash1,path2:hash2"
      const hashPairs = ORIGINAL_HASHES.split(',').map(p => {
        const [filePath, hash] = p.split(':');
        return { path: filePath.trim(), expectedHash: hash.trim() };
      });

      for (const { path: filePath, expectedHash } of hashPairs) {
        try {
          // SSH into proxmox → pct exec 100 → sha256sum
          const cmd = `sshpass -p '${SSH_PASS}' ssh -o StrictHostKeyChecking=no root@51.255.93.127 "pct exec 100 -- sha256sum '${filePath}'"`;
          const output = execSync(cmd, { timeout: 30_000, encoding: 'utf8' }).trim();
          const actualHash = output.split(/\s+/)[0];

          console.log(`File: ${filePath}`);
          console.log(`  Expected: ${expectedHash}`);
          console.log(`  Actual:   ${actualHash}`);
          console.log(`  Match:    ${actualHash === expectedHash}`);
          expect(actualHash).toBe(expectedHash);
        } catch (e) {
          console.error(`SHA-256 verification failed for ${filePath}: ${e.message}`);
          throw e;
        }
      }
      console.log('=== All SHA-256 hashes MATCH ===\n');
    } else {
      console.log('SHA-256 verification skipped (no ORIGINAL_HASHES or SSH_PASS provided)');
    }

    // ── Step 7: Navigate UI and take screenshot for proof ──
    await page.goto(PANEL_URL);
    await page.evaluate((data) => {
      sessionStorage.setItem('pb_auth', JSON.stringify({
        token: data.token,
        email: data.email,
        emailVerified: true,
      }));
    }, { token: authToken, email: TEST_EMAIL });

    await page.goto(`${PANEL_URL}/servers/${SERVER_ID}?name=e2e-test-server`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Capture proof screenshot
    await page.screenshot({ path: 'test-results/recovery-done-proof.png', fullPage: true });
    console.log('Proof screenshot saved: test-results/recovery-done-proof.png');
  });
});
