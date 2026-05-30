/**
 * E2E Recovery Test — ProperBackup
 *
 * Proves the full restore path on a live test server:
 *   Part 1 — API restore: download encrypted object → decrypt in-browser → extract → SHA-256 verify
 *   Part 2 — UI smoke: login → servers → backups page → Timeline with snapshot visible
 *
 * Prerequisites (env vars):
 *   PROPERBACKUP_PANEL_URL        — panel URL (default: http://properbackup-test-server.softify.com.pl)
 *   PROPERBACKUP_TEST_EMAIL       — test account email
 *   PROPERBACKUP_TEST_PASS        — test account password
 *   PROPERBACKUP_ENC_PASS         — encryption password used by the agent
 *   PROPERBACKUP_SERVER_ID        — registered server ID
 *   PROPERBACKUP_ORIGINAL_SHA256  — SHA-256 of the original test file
 *   PROPERBACKUP_ORIGINAL_FILENAME — file to verify inside the tar.gz (default: testfile.txt)
 */
import { test, expect } from '@playwright/test';
import { createHash, pbkdf2Sync, createDecipheriv } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const PANEL_URL = process.env.PROPERBACKUP_PANEL_URL || 'http://properbackup-test-server.softify.com.pl';
const TEST_EMAIL = process.env.PROPERBACKUP_TEST_EMAIL;
const TEST_PASS = process.env.PROPERBACKUP_TEST_PASS;
const ENC_PASS = process.env.PROPERBACKUP_ENC_PASS;
const SERVER_ID = process.env.PROPERBACKUP_SERVER_ID;
const ORIGINAL_SHA256 = process.env.PROPERBACKUP_ORIGINAL_SHA256;
const ORIGINAL_FILENAME = process.env.PROPERBACKUP_ORIGINAL_FILENAME || 'testfile.txt';

test.describe('Recovery E2E — single file restore + SHA-256 verification', () => {
  let authToken;

  test.beforeEach(async () => {
    for (const [name, val] of [
      ['PROPERBACKUP_TEST_EMAIL', TEST_EMAIL],
      ['PROPERBACKUP_TEST_PASS', TEST_PASS],
      ['PROPERBACKUP_ENC_PASS', ENC_PASS],
      ['PROPERBACKUP_SERVER_ID', SERVER_ID],
      ['PROPERBACKUP_ORIGINAL_SHA256', ORIGINAL_SHA256],
    ]) {
      if (!val) throw new Error(`Missing env var: ${name}`);
    }
  });

  test('It should download, decrypt, and verify a backup file matches the original SHA-256', async ({ page }) => {
    // ── Step 1: Login via API ──
    const loginRes = await page.request.post(`${PANEL_URL}/api/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    expect(loginRes.ok(), `Login failed: ${loginRes.status()}`).toBeTruthy();
    const authData = await loginRes.json();
    authToken = authData.token;
    expect(authToken).toBeTruthy();

    // ── Step 2: Fetch archive snapshots to get the object name ──
    const snapshotsRes = await page.request.get(
      `${PANEL_URL}/api/servers/${SERVER_ID}/archive-snapshots`,
      { headers: { 'Authorization': `Bearer ${authToken}` } },
    );
    expect(snapshotsRes.ok()).toBeTruthy();
    const snapshots = await snapshotsRes.json();
    expect(snapshots.length).toBeGreaterThan(0);

    const snapshot = snapshots[0];
    const objectName = snapshot.objectName;
    expect(objectName).toBeTruthy();
    console.log(`Snapshot: ${objectName} (${snapshot.sizeBytes} bytes, sealed ${snapshot.sealedAt})`);

    // ── Step 3: Download the encrypted object ──
    const downloadRes = await page.request.get(
      `${PANEL_URL}/api/objects/${encodeURIComponent(objectName)}`,
      { headers: { 'Authorization': `Bearer ${authToken}` } },
    );
    expect(downloadRes.ok(), `Download failed: ${downloadRes.status()}`).toBeTruthy();
    const encBuffer = await downloadRes.body();
    expect(encBuffer.length).toBeGreaterThan(49); // Must be larger than header

    console.log(`Downloaded encrypted object: ${encBuffer.length} bytes`);

    // ── Step 4: Decrypt in Node.js using the same AES-256-GCM algorithm ──
    // ProperBackup .enc format:
    //   [49-byte header: PROP(4) + version(1) + salt(16) + canaryNonce(12) + canaryTag(16)]
    //   Then chunks: [4-byte BE frameLen][12-byte nonce][ciphertext + 16-byte GCM tag]

    const HEADER_SIZE = 49;
    const PBKDF2_ITERS = 200_000;

    // Parse header
    expect(encBuffer[0]).toBe(0x50); // P
    expect(encBuffer[1]).toBe(0x52); // R
    expect(encBuffer[2]).toBe(0x4F); // O
    expect(encBuffer[3]).toBe(0x50); // P
    expect(encBuffer[4]).toBe(0x01); // version

    const salt = encBuffer.subarray(5, 21);

    // Derive AES-256 key from password + salt (PBKDF2-SHA256)
    const key = pbkdf2Sync(ENC_PASS, salt, PBKDF2_ITERS, 32, 'sha256');

    // Decrypt data chunks
    const chunks = [];
    let offset = HEADER_SIZE;

    while (offset < encBuffer.length) {
      if (offset + 4 > encBuffer.length) break;
      const frameLen = encBuffer.readUInt32BE(offset);
      offset += 4;
      if (offset + frameLen > encBuffer.length) throw new Error(`Truncated chunk at ${offset}`);

      const nonce = encBuffer.subarray(offset, offset + 12);
      // GCM tag is the last 16 bytes of the frame data
      const cipherAndTag = encBuffer.subarray(offset + 12, offset + frameLen);
      const tagStart = cipherAndTag.length - 16;
      const ciphertext = cipherAndTag.subarray(0, tagStart);
      const authTag = cipherAndTag.subarray(tagStart);
      offset += frameLen;

      const decipher = createDecipheriv('aes-256-gcm', key, nonce);
      decipher.setAuthTag(authTag);
      const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      chunks.push(plain);
    }

    const decryptedBuf = Buffer.concat(chunks);
    console.log(`Decrypted tar.gz: ${decryptedBuf.length} bytes`);

    // ── Step 5: Write tar.gz to disk and extract ──
    const extractDir = path.join('/tmp', `e2e-extract-${Date.now()}`);
    const tarPath = path.join('/tmp', `e2e-decrypted-${Date.now()}.tar.gz`);
    fs.mkdirSync(extractDir, { recursive: true });
    fs.writeFileSync(tarPath, decryptedBuf);

    execSync(`tar xzf "${tarPath}" -C "${extractDir}"`, { timeout: 10_000 });

    // ── Step 6: Find and verify the test file ──
    const foundFile = findFile(extractDir, ORIGINAL_FILENAME);
    expect(foundFile, `File '${ORIGINAL_FILENAME}' not found in extracted archive`).toBeTruthy();

    const fileContent = fs.readFileSync(foundFile);
    const sha256 = createHash('sha256').update(fileContent).digest('hex');

    console.log(`\n=== SHA-256 Verification ===`);
    console.log(`Original:  ${ORIGINAL_SHA256}`);
    console.log(`Restored:  ${sha256}`);
    console.log(`Match:     ${sha256 === ORIGINAL_SHA256}`);
    console.log(`File size: ${fileContent.length} bytes`);
    console.log(`===========================\n`);

    expect(sha256).toBe(ORIGINAL_SHA256);

    // Cleanup
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.unlinkSync(tarPath);
  });

  test('It should download a backup via UI, decrypt, and verify SHA-256 matches original', async ({ page }) => {
    // ── Step 1: Login via API and inject auth ──
    const loginRes = await page.request.post(`${PANEL_URL}/api/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASS },
    });
    expect(loginRes.ok()).toBeTruthy();
    const authData = await loginRes.json();
    authData.emailVerified = true;

    await page.goto(PANEL_URL);
    await page.evaluate((data) => {
      sessionStorage.setItem('pb_auth', JSON.stringify(data));
    }, authData);

    // ── Step 2: Navigate to server's backup page ──
    await page.goto(`${PANEL_URL}/servers/${SERVER_ID}?name=e2e-test-server`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('text=e2e-test-server').first()).toBeVisible({ timeout: 15_000 });

    // ── Step 3: Switch to Timeline tab ──
    const timelineTab = page.locator('button', { hasText: 'Timeline' });
    await expect(timelineTab).toBeVisible({ timeout: 10_000 });
    await timelineTab.click();
    await page.waitForTimeout(2000);

    // ── Step 4: Verify timeline shows snapshot ──
    await expect(page.getByText('backup', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('584 B').first()).toBeVisible({ timeout: 5_000 });

    // ── Step 5: Click snapshot to select it (this switches to Files tab) ──
    const backupBadge = page.getByText('backup', { exact: true });
    await backupBadge.click();
    await page.waitForTimeout(2000);

    // ── Step 6: Go back to Timeline — detail panel with Download button appears ──
    const timelineTab2 = page.locator('button', { hasText: 'Timeline' });
    await timelineTab2.click();
    await page.waitForTimeout(1500);

    const downloadBtn = page.locator('button').filter({ hasText: /Download/ }).first();
    await expect(downloadBtn).toBeVisible({ timeout: 5_000 });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      downloadBtn.click(),
    ]);

    // ── Step 7: Save downloaded file and read its content ──
    const downloadPath = path.join('/tmp', `e2e-ui-download-${Date.now()}.enc`);
    await download.saveAs(downloadPath);
    const encBuffer = fs.readFileSync(downloadPath);
    expect(encBuffer.length).toBeGreaterThan(49);
    console.log(`UI-downloaded encrypted object: ${encBuffer.length} bytes`);

    // ── Step 8: Decrypt (identical algorithm as Test 1) ──
    const HEADER_SIZE = 49;
    const PBKDF2_ITERS = 200_000;

    expect(encBuffer[0]).toBe(0x50); // P
    expect(encBuffer[1]).toBe(0x52); // R
    expect(encBuffer[2]).toBe(0x4F); // O
    expect(encBuffer[3]).toBe(0x50); // P
    expect(encBuffer[4]).toBe(0x01); // version

    const salt = encBuffer.subarray(5, 21);
    const key = pbkdf2Sync(ENC_PASS, salt, PBKDF2_ITERS, 32, 'sha256');

    const chunks = [];
    let offset = HEADER_SIZE;
    while (offset < encBuffer.length) {
      if (offset + 4 > encBuffer.length) break;
      const frameLen = encBuffer.readUInt32BE(offset);
      offset += 4;
      if (offset + frameLen > encBuffer.length) throw new Error(`Truncated chunk at ${offset}`);

      const nonce = encBuffer.subarray(offset, offset + 12);
      const cipherAndTag = encBuffer.subarray(offset + 12, offset + frameLen);
      const tagStart = cipherAndTag.length - 16;
      const ciphertext = cipherAndTag.subarray(0, tagStart);
      const authTag = cipherAndTag.subarray(tagStart);
      offset += frameLen;

      const decipher = createDecipheriv('aes-256-gcm', key, nonce);
      decipher.setAuthTag(authTag);
      const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      chunks.push(plain);
    }

    const decryptedBuf = Buffer.concat(chunks);
    console.log(`UI-decrypted tar.gz: ${decryptedBuf.length} bytes`);

    // ── Step 9: Extract tar.gz ──
    const extractDir = path.join('/tmp', `e2e-ui-extract-${Date.now()}`);
    const tarPath = path.join('/tmp', `e2e-ui-decrypted-${Date.now()}.tar.gz`);
    fs.mkdirSync(extractDir, { recursive: true });
    fs.writeFileSync(tarPath, decryptedBuf);
    execSync(`tar xzf "${tarPath}" -C "${extractDir}"`, { timeout: 10_000 });

    // ── Step 10: Find and verify SHA-256 ──
    const foundFile = findFile(extractDir, ORIGINAL_FILENAME);
    expect(foundFile, `File '${ORIGINAL_FILENAME}' not found in extracted archive`).toBeTruthy();

    const fileContent = fs.readFileSync(foundFile);
    const sha256 = createHash('sha256').update(fileContent).digest('hex');

    console.log(`\n=== UI Download SHA-256 Verification ===`);
    console.log(`Original:  ${ORIGINAL_SHA256}`);
    console.log(`Restored:  ${sha256}`);
    console.log(`Match:     ${sha256 === ORIGINAL_SHA256}`);
    console.log(`File size: ${fileContent.length} bytes`);
    console.log(`=========================================\n`);

    expect(sha256).toBe(ORIGINAL_SHA256);

    // Cleanup
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.unlinkSync(tarPath);
    fs.unlinkSync(downloadPath);
  });
});

/** Recursively find a file by name in a directory tree. */
function findFile(dir, filename) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(fullPath, filename);
      if (found) return found;
    } else if (entry.name === filename) {
      return fullPath;
    }
  }
  return null;
}
