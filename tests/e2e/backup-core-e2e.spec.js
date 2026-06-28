/**
 * E2E test01 — FULL backup→restore pipeline on the live dedyk stack (LXC 100).
 *
 * Proves the core ProperBackup contract end-to-end, with NO mocks of the parts
 * that matter (encryption, seal, storage, restore, SHA-256):
 *
 *   1. agent --once   : scan a fresh source dir → tar.gz → AES-256-GCM encrypt → upload to buffer
 *   2. buffer /flush  : seal the uploaded fragments into a .enc object on /mnt/storage/backups
 *   3. DB assertion   : a new archive_snapshot row exists (flag=A, size matches)
 *   4. disk assertion : the .enc object exists on /mnt/storage/backups with the DB-recorded size
 *   5. restore        : GET /api/objects/{name} → AES-256-GCM decrypt → extract tar.gz
 *   6. SHA-256 verify : every restored file byte-for-byte matches the original it was backed up from
 *
 * Runs INSIDE LXC 100 (panel :80, buffer :8080, postgres in docker, /mnt/storage local).
 *
 * Env (all have sane dedyk defaults; the runner exports the secrets):
 *   PB_PANEL_URL, PB_BUFFER_URL, PB_SERVER_ID, PB_ENC_PASS, PB_JWT,
 *   PB_AGENT_JAR, PB_AGENT_DIR, PB_SOURCE_DIR, PB_CONF_DIR
 */
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { sh, snapshotCount, snapshotByObject } from './helpers/localPipeline.js';
import { decryptEnc } from './helpers/properCrypto.js';

const PANEL_URL = process.env.PB_PANEL_URL || 'http://127.0.0.1:80';
const BUFFER_URL = process.env.PB_BUFFER_URL || 'http://127.0.0.1:8080';
const SERVER_ID = process.env.PB_SERVER_ID || '194efe2e-9309-4376-a240-6ccdc6afa188';
const ENC_PASS = process.env.PB_ENC_PASS || 'e2e-test-password-2026';
const JWT = process.env.PB_JWT;
const AGENT_JAR = process.env.PB_AGENT_JAR || '/opt/pb-agent-e2e/properbackup-agent-all.jar';
const AGENT_DIR = process.env.PB_AGENT_DIR || '/opt/pb-agent-e2e';
const SOURCE_DIR = process.env.PB_SOURCE_DIR || '/opt/pb-agent-e2e/backup-source';
const CONF_DIR = process.env.PB_CONF_DIR || '/opt/pb-agent-e2e/conf.fullpipe';

const AGENT_MAIN = 'pl.danielniemiec.properbackup.agent.AgentMain';

/** sha256 hex of a file on disk. */
function sha256File(p) {
  return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

test.describe('test01 — full agent→buffer→seal→storage→restore→SHA-256 pipeline', () => {
  // canonical originals, captured at backup time
  const originals = {}; // filename -> { sha256, size }
  let runStartIso;

  test.beforeAll(() => {
    expect(JWT, 'PB_JWT must be provided (service-admin token)').toBeTruthy();

    // ── Prepare a FRESH, unique backup source so this run produces a brand-new object ──
    fs.rmSync(SOURCE_DIR, { recursive: true, force: true });
    fs.mkdirSync(SOURCE_DIR, { recursive: true });

    const stamp = new Date().toISOString().replace(/[^0-9]/g, '');
    const canary = `fullpipe-canary ${stamp} ${randomBytes(16).toString('hex')}\n`;
    fs.writeFileSync(path.join(SOURCE_DIR, 'canary.txt'), canary);
    fs.writeFileSync(path.join(SOURCE_DIR, 'random-128k.bin'), randomBytes(128 * 1024));
    fs.writeFileSync(path.join(SOURCE_DIR, 'nested-readme.txt'), `nested ${stamp}\n`);

    for (const name of fs.readdirSync(SOURCE_DIR)) {
      const fp = path.join(SOURCE_DIR, name);
      originals[name] = { sha256: sha256File(fp), size: fs.statSync(fp).size };
    }

    // ── Isolated conf dir: only the e2e-fullpipe service, so the newest snapshot is unambiguously ours ──
    fs.rmSync(CONF_DIR, { recursive: true, force: true });
    fs.mkdirSync(CONF_DIR, { recursive: true });
    fs.copyFileSync(path.join(AGENT_DIR, 'conf.d', 'global.yml'), path.join(CONF_DIR, 'global.yml'));
    fs.writeFileSync(
      path.join(CONF_DIR, 'e2e-fullpipe.yml'),
      `service: e2e-fullpipe\npaths:\n  - ${SOURCE_DIR}\nexclude: []\n`,
    );
    // Fresh agent state so every file is detected as added (no delta cache from a prior run).
    sh(`rm -rf ${AGENT_DIR}/state/* ${CONF_DIR}/.agent.lock 2>/dev/null || true`);
  });

  test('It should back up fresh files and restore them byte-for-byte (SHA-256)', async ({ page, request }) => {
    const countBefore = snapshotCount(SERVER_ID);
    runStartIso = new Date(Date.now() - 5000).toISOString();

    // ── Step 1: BACKUP — agent --once (real scan → tar.gz → AES-256-GCM → upload) ──
    const agentOut = sh(
      `cd ${AGENT_DIR} && java -cp ${AGENT_JAR} ${AGENT_MAIN} ` +
      `--config ${CONF_DIR}/global.yml --conf-dir ${CONF_DIR} --once --headless 2>&1`,
      { timeout: 120000 },
    );
    expect(agentOut, 'agent should report it uploaded the source').toContain('Uploaded');
    expect(agentOut).toContain(SOURCE_DIR);

    // ── Step 2: SEAL — force the buffer to seal uploaded fragments into a .enc object ──
    const flushRes = await request.post(`${BUFFER_URL}/flush`, {
      headers: { Authorization: `Bearer ${JWT}` },
    });
    expect(flushRes.ok(), `POST /flush failed: ${flushRes.status()}`).toBeTruthy();

    // ── Step 3: DB-FIRST — a new archive_snapshot row must exist for this server ──
    const countAfter = snapshotCount(SERVER_ID);
    expect(countAfter, 'a new archive_snapshot must be sealed').toBeGreaterThan(countBefore);

    // newest snapshot for this server = the object we just produced (single-service conf)
    const snapsRes = await request.get(`${PANEL_URL}/api/servers/${SERVER_ID}/archive-snapshots`, {
      headers: { Authorization: `Bearer ${JWT}` },
    });
    expect(snapsRes.ok(), `archive-snapshots failed: ${snapsRes.status()}`).toBeTruthy();
    const snaps = await snapsRes.json();
    expect(snaps.length).toBeGreaterThan(0);
    const snapshot = snaps.sort((a, b) => new Date(b.sealedAt) - new Date(a.sealedAt))[0];
    const objectName = snapshot.objectName;
    expect(objectName, 'newest snapshot must have an object name').toBeTruthy();
    expect(new Date(snapshot.sealedAt).getTime(), 'snapshot must be freshly sealed by THIS run')
      .toBeGreaterThan(new Date(runStartIso).getTime());

    // DB row cross-check (flag Added, positive size)
    const dbRow = snapshotByObject(SERVER_ID, objectName);
    expect(dbRow, `archive_snapshot row for ${objectName} must exist`).not.toBeNull();
    expect(dbRow.flag).toBe('A');
    const dbSize = parseInt(dbRow.size_bytes, 10);
    expect(dbSize).toBeGreaterThan(0);

    // ── Step 4: FILES-ON-DISK — the sealed .enc must physically exist on /mnt/storage ──
    const diskPath = `/mnt/storage/backups/${objectName}`;
    const diskSize = parseInt(sh(`stat -c %s ${diskPath}`), 10);
    expect(diskSize, 'on-disk .enc size must equal the DB-recorded size').toBe(dbSize);

    // ── Step 5: RESTORE — download the encrypted object via the panel API ──
    const dlRes = await request.get(`${PANEL_URL}/api/objects/${encodeURIComponent(objectName)}`, {
      headers: { Authorization: `Bearer ${JWT}` },
    });
    expect(dlRes.ok(), `object download failed: ${dlRes.status()}`).toBeTruthy();
    const encBuffer = Buffer.from(await dlRes.body());
    expect(encBuffer.length).toBe(diskSize);

    // ── Step 6: DECRYPT + EXTRACT + SHA-256 verify against the originals ──
    const tarGz = decryptEnc(encBuffer, ENC_PASS);
    const work = fs.mkdtempSync('/tmp/e2e-restore-');
    const tarPath = path.join(work, 'restored.tar.gz');
    const outDir = path.join(work, 'out');
    fs.mkdirSync(outDir);
    fs.writeFileSync(tarPath, tarGz);
    sh(`tar xzf ${tarPath} -C ${outDir}`, { timeout: 30000 });

    // every original file must be present and byte-identical
    const restored = {};
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, e.name);
        if (e.isDirectory()) walk(fp);
        else restored[e.name] = sha256File(fp);
      }
    };
    walk(outDir);

    // every original file must be present and byte-for-byte identical
    for (const [name, meta] of Object.entries(originals)) {
      expect(restored[name], `restored archive must contain ${name}`).toBeTruthy();
      expect(restored[name], `${name} SHA-256 must match the original`).toBe(meta.sha256);
    }
    // the agent injects exactly one metadata index (.properbackup-idx); assert it is
    // present and that NO other unexpected file leaked into the archive.
    const META = '.properbackup-idx';
    expect(restored[META], 'archive must contain the .properbackup-idx path index').toBeTruthy();
    const dataFiles = Object.keys(restored).filter((n) => n !== META).sort();
    expect(dataFiles, 'restored data files must be exactly the originals (no extras)')
      .toEqual(Object.keys(originals).sort());

    fs.rmSync(work, { recursive: true, force: true });

    // ── Step 7 (UI smoke, secondary): panel renders the server's Timeline with the snapshot ──
    const loginToken = JWT;
    await page.goto(PANEL_URL);
    await page.evaluate((data) => sessionStorage.setItem('pb_auth', JSON.stringify(data)),
      { token: loginToken, emailVerified: true });
    await page.goto(`${PANEL_URL}/servers/${SERVER_ID}?name=devin-agent-e2e`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toContainText('devin-agent-e2e', { timeout: 15000 });
  });
});
