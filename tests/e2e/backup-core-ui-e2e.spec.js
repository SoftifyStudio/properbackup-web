/**
 * E2E test01 (UI-driven) — FULL backup→restore pipeline on the live dedyk stack (LXC 100),
 * with the RESTORE driven entirely through the panel UI so the native .webm is a real,
 * human-watchable proof of the product in action.
 *
 * Hard correctness assertions are UNCHANGED and stay strict (UI is a visibility layer,
 * never a replacement for verification):
 *
 *   1. agent --once   : scan a fresh source dir → tar.gz → AES-256-GCM encrypt → upload to buffer
 *   2. buffer /flush  : seal the uploaded fragments into a .enc object on /mnt/storage/backups
 *   3. DB-FIRST       : a new archive_snapshot row exists (flag=A, positive size)   [psql in LXC 100]
 *   4. FILES-ON-DISK  : the .enc object physically exists on /mnt/storage with the DB-recorded size
 *
 *   --- restore, driven through the UI (this is what the .webm shows) ---
 *   5. FORM LOGIN     : fill the panel login form (email + password) and sign in
 *   6. NAVIGATE       : servers list → open the server → Timeline tab → select the fresh snapshot
 *   7. RESTORE WIZARD : click "Restore" → step through Snapshot → Password (verify) → Thaw → Download
 *                       The browser downloads + AES-256-GCM decrypts the object with Web Crypto and
 *                       saves the .tar.gz; an on-screen "Downloaded and decrypted" confirmation appears.
 *   8. SHA-256 verify : extract the UI-produced .tar.gz and assert every restored file is byte-for-byte
 *                       identical to the original it was backed up from (+ exactly one .properbackup-idx,
 *                       no stray files). This verifies the product's own (browser) restore output.
 *
 * Runs INSIDE LXC 100 (panel :80, buffer :8080, postgres in docker, /mnt/storage local).
 *
 * Env (sane dedyk defaults; the runner exports the secrets):
 *   PB_PANEL_URL, PB_BUFFER_URL, PB_SERVER_ID, PB_SERVER_NAME, PB_ENC_PASS, PB_JWT,
 *   PB_PANEL_EMAIL, PB_PANEL_PASS,
 *   PB_AGENT_JAR, PB_AGENT_DIR, PB_SOURCE_DIR, PB_CONF_DIR
 */
import { test, expect } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { sh, snapshotCount, snapshotByObject } from './helpers/localPipeline.js';

const PANEL_URL = process.env.PB_PANEL_URL || 'http://127.0.0.1:80';
const BUFFER_URL = process.env.PB_BUFFER_URL || 'http://127.0.0.1:8080';
const SERVER_ID = process.env.PB_SERVER_ID || '194efe2e-9309-4376-a240-6ccdc6afa188';
const SERVER_NAME = process.env.PB_SERVER_NAME || 'devin-agent-e2e';
const ENC_PASS = process.env.PB_ENC_PASS || 'e2e-test-password-2026';
const JWT = process.env.PB_JWT;
const PANEL_EMAIL = process.env.PB_PANEL_EMAIL || 'e2e-test@properbackup.pl';
const PANEL_PASS = process.env.PB_PANEL_PASS;
const AGENT_JAR = process.env.PB_AGENT_JAR || '/opt/pb-agent-e2e/properbackup-agent-all.jar';
const AGENT_DIR = process.env.PB_AGENT_DIR || '/opt/pb-agent-e2e';
const SOURCE_DIR = process.env.PB_SOURCE_DIR || '/opt/pb-agent-e2e/backup-source';
const CONF_DIR = process.env.PB_CONF_DIR || '/opt/pb-agent-e2e/conf.uipipe';

const AGENT_MAIN = 'pl.danielniemiec.properbackup.agent.AgentMain';

/** sha256 hex of a file on disk. */
function sha256File(p) {
  return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

/** A short, deliberate on-screen pause so the .webm is watchable by a human. */
async function beat(page, ms = 1200) {
  await page.waitForTimeout(ms);
}

test.describe('test01 (UI) — full pipeline, restore driven through the panel UI', () => {
  const originals = {}; // filename -> { sha256, size }
  let runStartIso;

  test.beforeAll(() => {
    expect(JWT, 'PB_JWT must be provided (service-admin token)').toBeTruthy();
    expect(PANEL_PASS, 'PB_PANEL_PASS must be provided (panel login password)').toBeTruthy();

    // ── Prepare a FRESH, unique backup source so this run produces a brand-new object ──
    fs.rmSync(SOURCE_DIR, { recursive: true, force: true });
    fs.mkdirSync(SOURCE_DIR, { recursive: true });

    const stamp = new Date().toISOString().replace(/[^0-9]/g, '');
    const canary = `uipipe-canary ${stamp} ${randomBytes(16).toString('hex')}\n`;
    fs.writeFileSync(path.join(SOURCE_DIR, 'canary.txt'), canary);
    fs.writeFileSync(path.join(SOURCE_DIR, 'random-128k.bin'), randomBytes(128 * 1024));
    fs.writeFileSync(path.join(SOURCE_DIR, 'nested-readme.txt'), `nested ${stamp}\n`);

    for (const name of fs.readdirSync(SOURCE_DIR)) {
      const fp = path.join(SOURCE_DIR, name);
      originals[name] = { sha256: sha256File(fp), size: fs.statSync(fp).size };
    }

    // ── Isolated conf dir: only the e2e-uipipe service, so the newest snapshot is unambiguously ours ──
    fs.rmSync(CONF_DIR, { recursive: true, force: true });
    fs.mkdirSync(CONF_DIR, { recursive: true });
    fs.copyFileSync(path.join(AGENT_DIR, 'conf.d', 'global.yml'), path.join(CONF_DIR, 'global.yml'));
    fs.writeFileSync(
      path.join(CONF_DIR, 'e2e-uipipe.yml'),
      `service: e2e-uipipe\npaths:\n  - ${SOURCE_DIR}\nexclude: []\n`,
    );
    // Fresh agent state so every file is detected as added (no delta cache from a prior run).
    sh(`rm -rf ${AGENT_DIR}/state/* ${CONF_DIR}/.agent.lock 2>/dev/null || true`);
  });

  test('It should back up fresh files and restore them through the UI (byte-for-byte SHA-256)', async ({ page, request }, testInfo) => {
    // ─────────────────────────────────────────────────────────────────────────
    // PHASE A — BACKUP + SEAL + hard DB/disk assertions (setup; not the recording's focus)
    // ─────────────────────────────────────────────────────────────────────────
    const countBefore = snapshotCount(SERVER_ID);
    runStartIso = new Date(Date.now() - 5000).toISOString();

    const agentOut = sh(
      `cd ${AGENT_DIR} && java -cp ${AGENT_JAR} ${AGENT_MAIN} ` +
      `--config ${CONF_DIR}/global.yml --conf-dir ${CONF_DIR} --once --headless 2>&1`,
      { timeout: 120000 },
    );
    expect(agentOut, 'agent should report it uploaded the source').toContain('Uploaded');
    expect(agentOut).toContain(SOURCE_DIR);

    const flushRes = await request.post(`${BUFFER_URL}/flush`, {
      headers: { Authorization: `Bearer ${JWT}` },
    });
    expect(flushRes.ok(), `POST /flush failed: ${flushRes.status()}`).toBeTruthy();

    // DB-FIRST: a new archive_snapshot row must exist for this server
    const countAfter = snapshotCount(SERVER_ID);
    expect(countAfter, 'a new archive_snapshot must be sealed').toBeGreaterThan(countBefore);

    const snapsRes = await request.get(`${PANEL_URL}/api/servers/${SERVER_ID}/archive-snapshots`, {
      headers: { Authorization: `Bearer ${JWT}` },
    });
    expect(snapsRes.ok(), `archive-snapshots failed: ${snapsRes.status()}`).toBeTruthy();
    const snaps = await snapsRes.json();
    const snapshot = snaps.sort((a, b) => new Date(b.sealedAt) - new Date(a.sealedAt))[0];
    const objectName = snapshot.objectName;
    expect(objectName, 'newest snapshot must have an object name').toBeTruthy();
    expect(new Date(snapshot.sealedAt).getTime(), 'snapshot must be freshly sealed by THIS run')
      .toBeGreaterThan(new Date(runStartIso).getTime());

    const dbRow = snapshotByObject(SERVER_ID, objectName);
    expect(dbRow, `archive_snapshot row for ${objectName} must exist`).not.toBeNull();
    expect(dbRow.flag).toBe('A');
    const dbSize = parseInt(dbRow.size_bytes, 10);
    expect(dbSize).toBeGreaterThan(0);

    // FILES-ON-DISK: the sealed .enc must physically exist on /mnt/storage with the DB size
    const diskPath = `/mnt/storage/backups/${objectName}`;
    const diskSize = parseInt(sh(`stat -c %s ${diskPath}`), 10);
    expect(diskSize, 'on-disk .enc size must equal the DB-recorded size').toBe(dbSize);

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE B — RESTORE, DRIVEN THROUGH THE PANEL UI (this is what the .webm shows)
    // ─────────────────────────────────────────────────────────────────────────

    // Pin locale so on-screen labels are deterministic for the assertions below.
    await page.addInitScript(() => {
      try { localStorage.setItem('properbackup.locale', 'en'); } catch { /* ignore */ }
    });

    // 5) FORM LOGIN — real panel login form, not an API/sessionStorage shortcut.
    await page.goto(`${PANEL_URL}/login`);
    const emailInput = page.getByPlaceholder('e.g. you@company.com');
    const passInput = page.getByPlaceholder('Your password');
    await expect(emailInput, 'login form email field must be visible').toBeVisible();
    await emailInput.fill(PANEL_EMAIL);
    await passInput.fill(PANEL_PASS);
    await beat(page);
    await passInput.press('Enter');

    // 6) NAVIGATE — servers list → open our server → Timeline tab.
    const serverCard = page.getByText(SERVER_NAME, { exact: false }).first();
    await expect(serverCard, 'server card must appear after login').toBeVisible({ timeout: 30_000 });
    await beat(page);
    await serverCard.click();

    await expect(page.getByRole('button', { name: 'Timeline', exact: true }))
      .toBeVisible({ timeout: 30_000 });
    await beat(page);
    await page.getByRole('button', { name: 'Timeline', exact: true }).click();

    // Select the newest snapshot (rendered first; unique-per-run data ⇒ it is ours).
    // Selecting a snapshot switches the view to the Files tab for that moment.
    const snapRow = page.locator('div.cursor-pointer', { hasText: 'backup' }).first();
    await expect(snapRow, 'at least one backup snapshot must be listed in the Timeline')
      .toBeVisible({ timeout: 30_000 });
    await beat(page);
    await snapRow.click();

    // The snapshot view shows a "Viewing snapshot" banner with a restore action.
    const restoreToMoment = page.getByRole('button', { name: 'Restore to this moment' });
    await expect(restoreToMoment, 'selecting a snapshot must reveal its restore action')
      .toBeVisible({ timeout: 15_000 });

    // 7) RESTORE WIZARD — open it for the selected snapshot.
    await beat(page);
    await restoreToMoment.click();

    // Wizard step 0 — Snapshot summary. The file row must name the exact object we sealed,
    // which ties the on-screen UI selection to the DB/disk object verified above.
    await expect(page.getByRole('heading', { name: 'Data recovery' })).toBeVisible();
    await expect(page.getByText(objectName, { exact: false }),
      'wizard must show the exact object we sealed').toBeVisible({ timeout: 15_000 });
    await beat(page);
    await page.getByRole('button', { name: 'Next — enter password' }).click();

    // Wizard step 1 — Password verification (downloads PROP header, verifies locally).
    const wizardPass = page.locator('input[type="password"]');
    await expect(wizardPass).toBeVisible();
    await wizardPass.fill(ENC_PASS);
    await beat(page);
    await page.getByRole('button', { name: 'Verify password' }).click();

    // Wizard step 2 — Thaw progress (mock ~5s). Wait for the Download step to appear.
    const downloadBtn = page.getByRole('button', { name: 'Download and decrypt' });
    await expect(downloadBtn, 'thaw must complete and reveal the download step')
      .toBeVisible({ timeout: 30_000 });
    await beat(page);

    // Wizard step 3 — Download + in-browser AES-256-GCM decrypt; capture the saved file.
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      downloadBtn.click(),
    ]);
    const savedTarGz = path.join(testInfo.outputPath(), 'ui-restored.tar.gz');
    await download.saveAs(savedTarGz);

    // On-screen confirmation that the restore completed.
    await expect(page.getByText('Downloaded and decrypted')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('The tar.gz file was saved to your disk.')).toBeVisible();
    await beat(page, 1500);

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE C — SHA-256 verify the UI-produced restore output against the originals
    // ─────────────────────────────────────────────────────────────────────────
    const work = fs.mkdtempSync('/tmp/e2e-ui-restore-');
    const outDir = path.join(work, 'out');
    fs.mkdirSync(outDir);
    sh(`tar xzf ${savedTarGz} -C ${outDir}`, { timeout: 30000 });

    const restored = {};
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, e.name);
        if (e.isDirectory()) walk(fp);
        else restored[e.name] = sha256File(fp);
      }
    };
    walk(outDir);

    for (const [name, meta] of Object.entries(originals)) {
      expect(restored[name], `restored archive must contain ${name}`).toBeTruthy();
      expect(restored[name], `${name} SHA-256 must match the original`).toBe(meta.sha256);
    }
    const META = '.properbackup-idx';
    expect(restored[META], 'archive must contain the .properbackup-idx path index').toBeTruthy();
    const dataFiles = Object.keys(restored).filter((n) => n !== META).sort();
    expect(dataFiles, 'restored data files must be exactly the originals (no extras)')
      .toEqual(Object.keys(originals).sort());

    fs.rmSync(work, { recursive: true, force: true });
  });
});
