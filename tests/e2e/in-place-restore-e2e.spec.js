/**
 * test02 — In-place restore E2E (agent-driven "Restore to this point").
 *
 * This is the REAL recovery path Daniel asked for: the client clicks "Restore"
 * on a snapshot in the panel Timeline, a recovery session runs through the
 * buffer state machine, and the agent writes the snapshot state back IN PLACE
 * on the server — literal time-travel:
 *   - files modified after S1   -> reverted to S1 content
 *   - files deleted  after S1   -> re-created
 *   - files added    after S1   -> DELETED
 *
 * It is NOT the "Download and decrypt" path (that is recovery-e2e.spec.js).
 *
 * Flow:
 *   1. Reset backup-source to a deterministic baseline (S1) and back it up with
 *      the real agent  -> snapshot S1, record file SHA-256 set.
 *   2. Mutate the files on disk ("bzdury": modify / add / delete).
 *   3. UI: form login -> server -> Timeline -> click "Restore" on S1
 *      -> start modal -> dry-run -> confirmation modal -> confirm
 *      -> progress overlay reaches DONE.
 *   4. HARD assertions (not UI): file SHA-256 on the server == S1, the
 *      added-after-S1 file is gone, recovery_session=DONE and a pre-recovery
 *      snapshot exists (rollback safety).
 *
 * The agent runs are triggered from the test (off-screen, exactly like the
 * production agent daemon polling on its timer) so the run is deterministic.
 */
import { test, expect } from '@playwright/test';
import {
  resetBackupSourceBaseline,
  mutateBackupSourceAfterS1,
  runAgentOnce,
  runAgentOnceBackground,
  cancelActiveRecoverySessions,
  backupSourceShas,
  listBackupSourceFiles,
  latestSnapshotId,
  snapshotType,
  getRecoverySession,
} from './helpers/dedyk.js';

const PANEL_URL = process.env.PROPERBACKUP_PANEL_URL || 'http://51.255.93.127';
const TEST_EMAIL = process.env.PROPERBACKUP_TEST_EMAIL || 'e2e-test@properbackup.pl';
const TEST_PASS = process.env.PROPERBACKUP_TEST_PASS || process.env.PROPERBACKUP_TEST_ACCOUNT_PASSWORD;
const SERVER_ID = process.env.PROPERBACKUP_SERVER_ID || '194efe2e-9309-4376-a240-6ccdc6afa188';

test.describe('In-place restore E2E — agent-driven time-travel restore', () => {
  test.beforeAll(() => {
    if (!TEST_PASS) throw new Error('Missing PROPERBACKUP_TEST_PASS / PROPERBACKUP_TEST_ACCOUNT_PASSWORD');
  });

  test('It should restore a snapshot IN PLACE on the server when the user clicks Restore', async ({ page }) => {
    test.setTimeout(420_000);

    // ── Step 1: deterministic baseline (S1) + real backup ──
    cancelActiveRecoverySessions(SERVER_ID); // no stale RECOVERY_ALREADY_ACTIVE
    resetBackupSourceBaseline();
    runAgentOnce(); // creates a fresh FULL snapshot S1 (flag 'A')
    const s1Shas = backupSourceShas();
    expect(Object.keys(s1Shas).sort()).toEqual(
      ['canary.txt', 'nested-readme.txt', 'random-128k.bin'],
    );
    const s1SnapshotId = latestSnapshotId(SERVER_ID, { flag: 'A' });
    expect(s1SnapshotId, 'S1 snapshot must exist in DB').toBeGreaterThan(0);
    console.log(`S1 snapshot id=${s1SnapshotId}, SHAs=`, s1Shas);

    // ── Step 2: mutate on disk ("bzdury") ──
    mutateBackupSourceAfterS1();
    const mutated = listBackupSourceFiles();
    expect(mutated).toContain('file-added-after-s1.txt'); // added
    expect(mutated).not.toContain('nested-readme.txt');   // deleted

    // ── Step 3: form login ──
    await page.goto(PANEL_URL);
    await page.locator('input[type="email"]').first().fill(TEST_EMAIL);
    await page.locator('input[type="password"]').first().fill(TEST_PASS);
    await page.locator('button[type="submit"]').first().click();
    // logged in once the servers index renders (client-side nav, URL may stay at /)
    await expect(page.getByText('Your servers', { exact: false })).toBeVisible({ timeout: 30_000 });

    // ── Step 4: open the server Timeline ──
    await page.goto(`${PANEL_URL}/servers/${SERVER_ID}?tab=timeline&name=devin-agent-e2e`);
    await page.waitForLoadState('domcontentloaded');

    // The newest snapshot (S1, just created) renders FIRST in the timeline.
    const restoreBtn = page.locator('[data-testid="restore-to-point-button"]').first();
    await expect(restoreBtn).toBeVisible({ timeout: 30_000 });

    // ── Step 5: click Restore -> start modal -> capture session_id from /recovery/start ──
    await restoreBtn.click();
    await expect(page.locator('[data-testid="recovery-start-modal"]')).toBeVisible({ timeout: 10_000 });

    const startRespPromise = page.waitForResponse(
      (r) => r.url().includes('/recovery/start') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    // accept button in the start modal (full restore is the default mode)
    await page.locator('[data-testid="recovery-start-modal"] button.btn-primary').click();
    const startResp = await startRespPromise;
    expect(startResp.ok(), `start failed: ${startResp.status()}`).toBeTruthy();
    const startBody = await startResp.json();
    const sessionId = startBody.session_id;
    expect(sessionId, 'session_id from /recovery/start').toBeTruthy();
    console.log(`recovery session_id=${sessionId}`);

    // ── Step 6: agent dry-run (off-screen poll), then confirmation modal shows the plan ──
    runAgentOnce(); // picks up dry_run -> session AWAITING_USER_CONFIRM

    const confirmModal = page.locator('[data-testid="recovery-confirmation-modal"]').first();
    await expect(confirmModal).toBeVisible({ timeout: 30_000 });

    const ackBox = page.locator('[data-testid="recovery-acknowledge-checkbox"]').first();
    await expect(ackBox).toBeVisible({ timeout: 30_000 });
    await ackBox.check();

    const confirmBtn = page.locator('[data-testid="recovery-confirm-button"]').first();
    await expect(confirmBtn).toBeEnabled({ timeout: 30_000 });

    // DB sanity before confirm: dry-run computed restore=2 (canary+nested), delete=1 (added)
    const planned = getRecoverySession(sessionId);
    expect(planned.state).toBe('AWAITING_USER_CONFIRM');
    expect(planned.dryRunFilesToRestore).toBe('2');
    expect(planned.dryRunFilesToDelete).toBe('1');

    // ── Step 7: confirm -> agent executes restore (watch overlay reach DONE live) ──
    const agentExec = runAgentOnceBackground(); // non-blocking: picks up execute
    await confirmBtn.click();

    const overlay = page.locator('[data-testid="recovery-mode-overlay"]');
    await expect(overlay).toHaveAttribute('data-recovery-state', 'DONE', { timeout: 180_000 });
    await agentExec;

    // ── Step 8: HARD assertions on the SERVER (not UI) ──
    // 8a. time-travel: every S1 file restored to its exact S1 SHA-256
    const restoredShas = backupSourceShas();
    expect(restoredShas, 'files restored 1:1 to S1 state').toEqual(s1Shas);

    // 8b. the file added after S1 must be DELETED (literal time-travel)
    const afterFiles = listBackupSourceFiles();
    expect(afterFiles).not.toContain('file-added-after-s1.txt');
    expect(afterFiles.sort()).toEqual(['canary.txt', 'nested-readme.txt', 'random-128k.bin']);

    // 8c. DB: recovery_session reached DONE
    const finalSession = getRecoverySession(sessionId);
    expect(finalSession.state).toBe('DONE');

    // 8d. rollback safety: a pre-recovery snapshot was created before the restore
    expect(finalSession.preRecoverySnapshotId, 'pre-recovery snapshot must exist').toBeTruthy();
    expect(snapshotType(finalSession.preRecoverySnapshotId)).toBe('PRE_RECOVERY');

    console.log('FINAL session:', finalSession);
  });
});
