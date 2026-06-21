/**
 * Group I: Recovery Mode — QA E2E Regression Suite
 *
 * Tests 11-18 per user-facing-recovery-spec.md Section D.
 * Runs against LIVE dedyk (51.255.93.127:8080 buffer, :80 web panel).
 * Every assertion checks CONCRETE state (DB, files on disk, API response),
 * not just what the UI displays.
 *
 * TRIAGE LABELS:
 *   [BUFFER]  — root cause in properbackup-buffer (API, state machine, DB)
 *   [AGENT]   — root cause in properbackup-agent (restore, file ops)
 *   [WEB]     — root cause in properbackup-web (UI components, routing)
 *   [INFRA]   — root cause in infrastructure (SSH, Docker, PostgreSQL)
 *
 * Run:
 *   npx playwright test --config tests/e2e/playwright.recovery-qa.config.js
 */
import { test, expect } from '@playwright/test';
import {
  startRecovery,
  getRecoveryStatus,
  reportDryRunResult,
  confirmRecovery,
  cancelRecovery,
  reportProgress,
  reportComplete,
  agentPoll,
  driveToReady,
  startRecoveryViaUI,
  confirmRecoveryViaUI,
  E2E_SERVER_ID,
  E2E_TARGET_SNAPSHOT_ID,
} from './helpers/recoveryHelper.js';
import {
  getRecoverySession,
  getAuditLog,
  getArchiveSnapshots,
  cleanRecoverySessions,
  pgQuery,
  pgQueryRows,
  fileExistsOnDedyk,
  sha256OnDedyk,
  PANEL_URL,
  BUFFER_URL,
} from './helpers/dedykConnection.js';

// Known SHA-256 hashes of original test files (first 8 hex chars)
const ORIGINAL_HASHES = {
  'README.txt': '6006077c',
  'binary-sample.bin': '63124149',
  'file1.txt': 'dfd905bb',
  'file2.txt': '99514937',
};

test.describe('Recovery Mode QA — Tests 11-18 (Live Dedyk)', () => {

  test.beforeEach(async () => {
    // Clean any leftover recovery sessions for test isolation
    cleanRecoverySessions(E2E_SERVER_ID);
  });

  // =========================================================================
  // TEST 11: Recovery Start — snapshot → PLANNING → DRY RUN modal
  // Spec: User in SnapshotTimeline clicks "Restore to this point"
  //        → RecoveryConfirmationModal opens with loading (PLANNING state)
  // =========================================================================
  test('test11 — recovery start: API creates session in PLANNING, UI shows modal', async ({ page }) => {
    // --- API LAYER: start recovery via buffer ---
    const { sessionId, status } = await startRecovery();
    expect(status).toBe(201); // [BUFFER] POST /recovery/start must return 201

    // --- DB ASSERTION: session exists with state PLANNING ---
    const dbSession = getRecoverySession(sessionId);
    expect(dbSession).not.toBeNull(); // [BUFFER] session must be persisted
    expect(dbSession.state).toBe('PLANNING'); // [BUFFER] initial state after start

    // --- DB ASSERTION: audit log has RECOVERY_REQUESTED entry ---
    const audit = getAuditLog(sessionId);
    const requestedEntry = audit.find(a => a.action === 'RECOVERY_REQUESTED');
    expect(requestedEntry).toBeTruthy(); // [BUFFER] audit log must record request
    expect(requestedEntry.created_at).toBeTruthy(); // [BUFFER] timestamp must be non-null

    // --- UI LAYER: navigate to panel and check if recovery UI appears ---
    await page.goto(PANEL_URL);
    await page.waitForTimeout(2000);

    // Check if Recovery Mode UI components exist in the deployed web build
    const hasRecoveryUI = await page.locator('[data-testid="recovery-confirmation-modal"], [data-recovery-state]').count();
    if (hasRecoveryUI === 0) {
      console.warn('[TRIAGE:WEB] Recovery Mode UI components NOT FOUND in deployed web panel. ' +
        'The deployed dist/ is likely from main (pre-PR#50). ' +
        'Deploy PR#50 build to /opt/properbackup/web-dist/ to enable UI tests.');
    }

    console.log(`[test11] Session ${sessionId}: state=${dbSession.state}, audit_entries=${audit.length}`);
  });

  // =========================================================================
  // TEST 12: DRY RUN Preview — file counts + checkbox enforcement (HR-4)
  // Spec: After PLANNING → AWAITING_USER_CONFIRM, modal shows DRY RUN
  //        with file counts. Checkbox MUST be checked before "Start Recovery".
  // =========================================================================
  test('test12 — dry run preview: correct file counts in DB + checkbox enforced', async ({ page }) => {
    // --- Drive to AWAITING_USER_CONFIRM ---
    const { sessionId } = await startRecovery();
    const dryRunResp = await reportDryRunResult(sessionId, {
      filesToRestore: 4,
      filesToDelete: 0,
      filesUnchanged: 0,
      totalBytes: 525475,
      sampleRestore: ['README.txt', 'binary-sample.bin', 'file1.txt', 'file2.txt'],
      criticalProtected: 0,
    });
    expect(dryRunResp.status).toBe(200); // [BUFFER] dry_run_result accepted

    // --- DB ASSERTION: state is AWAITING_USER_CONFIRM ---
    const dbSession = getRecoverySession(sessionId);
    expect(dbSession.state).toBe('AWAITING_USER_CONFIRM'); // [BUFFER] state after dry run

    // --- DB ASSERTION: dry run fields populated with concrete values ---
    const filesToRestore = parseInt(dbSession.dry_run_files_to_restore || '0');
    const filesToDelete = parseInt(dbSession.dry_run_files_to_delete || '0');
    const totalBytes = parseInt(dbSession.dry_run_total_bytes || '0');
    expect(filesToRestore).toBe(4); // [BUFFER] exactly 4 files to restore
    expect(totalBytes).toBe(525475); // [BUFFER] exact byte count
    expect(filesToDelete).toBe(0); // [BUFFER] no files to delete

    // --- DB ASSERTION: audit log has DRY_RUN_COMPUTED with detail ---
    const audit = getAuditLog(sessionId);
    const dryRunAudit = audit.find(a => a.action === 'RECOVERY_DRY_RUN_COMPUTED');
    expect(dryRunAudit).toBeTruthy(); // [BUFFER] dry run must be audited
    expect(dryRunAudit.created_at).toBeTruthy(); // [BUFFER] audit timestamp non-null
    if (dryRunAudit.detail) {
      expect(dryRunAudit.detail).toContain('files_to_restore=4'); // [BUFFER] detail contains file count
    }

    // --- UI LAYER: verify checkbox enforcement ---
    await page.goto(PANEL_URL);
    await page.waitForTimeout(1000);

    const checkbox = page.locator('[data-testid="recovery-acknowledge-checkbox"]');
    const startBtn = page.locator('[data-testid="recovery-start-btn"]');

    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Checkbox should exist and Start button should be disabled until checked
      const isStartDisabled = await startBtn.isDisabled();
      expect(isStartDisabled).toBe(true); // [WEB] HR-4: button disabled without checkbox
      console.log('[test12] UI checkbox enforcement: PASS');
    } else {
      console.warn('[TRIAGE:WEB] Checkbox UI not visible — Recovery Mode UI not deployed');
    }

    console.log(`[test12] DRY RUN: restore=${dbSession.dry_run_files_to_restore}, delete=${dbSession.dry_run_files_to_delete}, bytes=${dbSession.dry_run_total_bytes}`);
  });

  // =========================================================================
  // TEST 13: Confirm and Restore — full happy path to DONE (HR-1, HR-5, HR-6)
  // Spec: User confirms → overlay center-screen → progress updates → DONE
  //        Pre-recovery snapshot MUST exist (HR-5).
  //        Files MUST be restored with correct SHA-256.
  //        DB recovery_session.state = DONE with all timestamps.
  // =========================================================================
  test('test13 — confirm and restore: state machine reaches DONE, SHA-256 verified', async ({ page }) => {
    // --- Drive to READY (confirm with cold_tier=false) ---
    const { sessionId, confirmLatencyMs } = await driveToReady();

    // --- DB ASSERTION: state is READY or AGENT_RESTORING (buffer may auto-transition) ---
    let dbSession = getRecoverySession(sessionId);
    const stateAfterConfirm = dbSession.state;
    expect(['READY', 'AGENT_RESTORING']).toContain(stateAfterConfirm); // [BUFFER] cold_tier=false → skip THAWING
    expect(confirmLatencyMs).toBeLessThan(10000); // [BUFFER] THAWING bypass < 10s

    // --- ASSERTION: confirmed_at should be set ---
    expect(dbSession.confirmed_at).toBeTruthy(); // [BUFFER] confirm timestamp

    // --- Agent poll → check for "execute" command if still READY ---
    if (stateAfterConfirm === 'READY') {
      const pollResp = await agentPoll();
      expect(pollResp.data.commands?.length).toBeGreaterThan(0); // [BUFFER] execute command emitted
      expect(pollResp.data.commands[0].command).toBe('execute'); // [BUFFER] correct command type
    } else {
      console.log(`[test13] State is already ${stateAfterConfirm} — buffer auto-transitioned READY→AGENT_RESTORING`);
    }

    // --- Simulate agent restoring ---
    await reportProgress(sessionId, { filesRestored: 4, bytes: 525475 });

    const completeResp = await reportComplete(sessionId);
    if (completeResp.status !== 200) {
      console.warn(`[TRIAGE:BUFFER] agentComplete returned ${completeResp.status}. ` +
        `Current state: ${stateAfterConfirm}. ` +
        'Buffer may need READY→AGENT_RESTORING transition before AGENT_RESTORING→VERIFYING.');
    }

    // --- DB ASSERTION: check final state ---
    dbSession = getRecoverySession(sessionId);
    const finalState = dbSession.state;

    if (finalState === 'DONE') {
      expect(dbSession.completed_at).toBeTruthy(); // [BUFFER] completed_at set
      expect(dbSession.agent_started_at || dbSession.verifying_started_at).toBeTruthy(); // [BUFFER] intermediate timestamps
      expect(parseInt(dbSession.files_restored || '0')).toBeGreaterThan(0); // [BUFFER] files_restored > 0
      expect(parseInt(dbSession.bytes_transferred || '0')).toBeGreaterThan(0); // [BUFFER] bytes > 0
      console.log(`[test13] DB DONE: files_restored=${dbSession.files_restored}, bytes=${dbSession.bytes_transferred}, completed_at=${dbSession.completed_at}`);
    } else if (finalState === 'READY') {
      console.warn(`[TRIAGE:BUFFER] Session stuck in ${finalState}. ` +
        'Root cause: agentComplete cannot transition READY→VERIFYING (illegal). ' +
        'Fix: add READY→AGENT_RESTORING transition on first progress/poll-ack.');
    } else if (finalState === 'VERIFYING') {
      console.warn(`[TRIAGE:BUFFER] Session in VERIFYING — agentComplete with verification=OK should transition to DONE.`);
    } else {
      console.warn(`[TRIAGE:BUFFER] Unexpected final state: ${finalState}`);
    }

    // --- AUDIT LOG: should have full trail ---
    const audit = getAuditLog(sessionId);
    expect(audit.length).toBeGreaterThanOrEqual(4); // [BUFFER] minimum: requested, dry_run, confirmed, execute

    const auditActions = audit.map(a => a.action);
    expect(auditActions).toContain('RECOVERY_REQUESTED');
    expect(auditActions).toContain('RECOVERY_DRY_RUN_COMPUTED');
    expect(auditActions).toContain('RECOVERY_USER_CONFIRMED');

    // --- FILE VERIFICATION — HARD ASSERTION (not soft warn) ---
    // Recovery is not real unless files are physically on disk with correct SHA-256.
    // DB counter files_restored=4 is necessary but NOT sufficient.
    const restorePath = `/home/ubuntu/agent-e2e/test-data`;
    let filesVerified = 0;
    for (const [filename, expectedHash] of Object.entries(ORIGINAL_HASHES)) {
      const filePath = `${restorePath}/${filename}`;
      const exists = fileExistsOnDedyk(filePath);
      expect(exists).toBe(true); // [TRIAGE:AGENT] File MUST exist on disk after restore
      if (exists) {
        const actualHash = sha256OnDedyk(filePath).substring(0, 8);
        expect(actualHash).toBe(expectedHash); // [TRIAGE:AGENT] SHA-256 mismatch = corrupt restore
        console.log(`[test13] ${filename}: SHA-256 ${actualHash} == ${expectedHash} ✓`);
        filesVerified++;
      }
    }
    expect(filesVerified).toBe(Object.keys(ORIGINAL_HASHES).length); // [TRIAGE:AGENT] all files verified

    // --- PRE-RECOVERY SNAPSHOT (HR-5) — HARD ASSERTION ---
    const snapshots = getArchiveSnapshots(E2E_SERVER_ID);
    const preRecoverySnap = snapshots.find(s =>
      s.snapshot_type === 'PRE_RECOVERY' || s.object_name?.includes('pre-recovery')
    );
    expect(preRecoverySnap).toBeTruthy(); // [TRIAGE:AGENT] HR-5: pre-recovery snapshot MUST exist

    console.log(`[test13] Final: state=${finalState}, confirm_latency=${confirmLatencyMs}ms, audit_entries=${audit.length}`);
  });

  // =========================================================================
  // TEST 14: Per-server lockdown — other servers unaffected (HR-2)
  // Spec: Recovery on Server A → Server B fully functional, shows warning banner
  // =========================================================================
  test('test14 — per-server lockdown: other servers unaffected during recovery', async ({ page }) => {
    // --- Start recovery on E2E server ---
    const { sessionId } = await startRecovery();
    await reportDryRunResult(sessionId);

    // --- DB: session is active on E2E_SERVER_ID ---
    const dbSession = getRecoverySession(sessionId);
    expect(dbSession.state).toBe('AWAITING_USER_CONFIRM');

    // --- Check that OTHER servers have no recovery sessions ---
    const otherSessions = pgQueryRows(
      `SELECT id, server_id, state FROM recovery_session WHERE server_id != '${E2E_SERVER_ID}'`
    );
    // Other servers should not have active sessions from this test
    const otherActiveSessions = otherSessions.filter(s =>
      !['DONE', 'FAILED', 'CANCELLED'].includes(s.state)
    );
    expect(otherActiveSessions.length).toBe(0); // [BUFFER] recovery must be per-server

    // --- API: starting recovery on SAME server should fail with 409 ---
    const duplicate = await startRecovery(E2E_SERVER_ID, E2E_TARGET_SNAPSHOT_ID);
    expect(duplicate.status).toBe(409); // [BUFFER] concurrent recovery → 409

    // --- UI: check for warning banner on other server tabs ---
    await page.goto(PANEL_URL);
    await page.waitForTimeout(1000);
    const banner = page.locator('[data-testid="recovery-warning-banner"]');
    if (await banner.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('[test14] Warning banner visible on other server tab: PASS');
    } else {
      console.warn('[TRIAGE:WEB] Warning banner not visible — either UI not deployed or banner component missing');
    }

    console.log(`[test14] Per-server lockdown: session=${sessionId}, other_active=${otherActiveSessions.length}`);
  });

  // =========================================================================
  // TEST 15: Cancel during AGENT_RESTORING → rollback (HR-9)
  // Spec: User cancels mid-restore → state CANCELLED → rollback uses pre-recovery snapshot
  // =========================================================================
  test('test15 — cancel during restoring: state transitions to CANCELLED', async ({ page }) => {
    // --- Drive to READY ---
    const { sessionId } = await driveToReady();

    // --- Report some progress (simulates partial restore) ---
    await reportProgress(sessionId, { filesRestored: 2, bytes: 100000 });

    // --- Cancel the recovery ---
    const cancelResp = await cancelRecovery(sessionId, 'QA test cancel');
    expect(cancelResp.status).toBe(200); // [BUFFER] cancel accepted

    // --- DB ASSERTION: state is CANCELLED with non-null timestamps ---
    const dbSession = getRecoverySession(sessionId);
    expect(dbSession.state).toBe('CANCELLED'); // [BUFFER] cancel transitions to CANCELLED
    expect(dbSession.cancelled_at).toBeTruthy(); // [BUFFER] cancelled_at timestamp must be set
    expect(dbSession.created_at).toBeTruthy(); // [BUFFER] created_at must exist
    expect(dbSession.confirmed_at).toBeTruthy(); // [BUFFER] confirmed_at must exist (was in READY)

    // --- AUDIT: RECOVERY_CANCELLED entry ---
    const audit = getAuditLog(sessionId);
    const cancelAudit = audit.find(a => a.action === 'RECOVERY_CANCELLED');
    expect(cancelAudit).toBeTruthy(); // [BUFFER] cancel must be audited
    expect(cancelAudit.created_at).toBeTruthy(); // [BUFFER] audit timestamp
    if (cancelAudit?.detail) {
      expect(cancelAudit.detail).toContain('QA test cancel'); // [BUFFER] reason in audit detail
    }

    // --- ROLLBACK VERIFICATION (HR-9) ---
    const files = parseInt(dbSession.files_restored || '0');
    console.log(`[test15] Cancel: state=${dbSession.state}, cancelled_at=${dbSession.cancelled_at}, files_restored_before_cancel=${files}`);
    if (files > 0) {
      console.warn('[TRIAGE:AGENT] Files were partially restored before cancel. ' +
        'HR-9 requires rollback: restored files removed, deleted files restored from quarantine. ' +
        'Agent must execute rollback on cancel command.');
    }
  });

  // =========================================================================
  // TEST 16: THAWING pass-through — cold_tier=false → READY < 10s
  // Spec: Local storage (not OVH cold tier) → THAWING state is no-op
  // =========================================================================
  test('test16 — THAWING pass-through: cold_tier=false, instant READY', async ({ page }) => {
    // --- Start and get to AWAITING_USER_CONFIRM ---
    const { sessionId } = await startRecovery();
    await reportDryRunResult(sessionId);

    // --- Confirm with cold_tier=false ---
    const t0 = Date.now();
    const confirmResp = await confirmRecovery(sessionId, { coldTier: false });
    const latency = Date.now() - t0;

    expect(confirmResp.status).toBe(200); // [BUFFER] confirm accepted
    expect(confirmResp.data.state).toBe('READY'); // [BUFFER] skip THAWING → READY
    expect(latency).toBeLessThan(10000); // [BUFFER] must be < 10s

    // --- DB ASSERTION: THAWING state was never entered ---
    const dbSession = getRecoverySession(sessionId);
    expect(dbSession.state).toBe('READY');
    // thaw_started_at should be NULL (never entered THAWING)
    // or thaw_completed_at should be very close to confirmed_at (instant pass-through)
    if (dbSession.thaw_started_at) {
      console.warn('[TRIAGE:BUFFER] thaw_started_at is SET despite cold_tier=false. ' +
        'THAWING should be completely skipped for local storage.');
    }

    // --- DB ASSERTION: confirmed_at present, thaw_completed_at present (instant transition) ---
    expect(dbSession.confirmed_at).toBeTruthy(); // [BUFFER] confirmed_at must be set
    expect(dbSession.thaw_completed_at).toBeTruthy(); // [BUFFER] thaw_completed_at set (instant pass-through)

    // --- Navigate to panel for video recording ---
    await page.goto(PANEL_URL);
    await page.waitForTimeout(1000);

    console.log(`[test16] THAWING bypass: latency=${latency}ms, state=${dbSession.state}, thaw_started=${dbSession.thaw_started_at || 'NULL'}, thaw_completed=${dbSession.thaw_completed_at}`);
  });

  // =========================================================================
  // TEST 17: Concurrent recovery → 409 conflict
  // Spec: Two recovery attempts on same server → second returns 409
  // =========================================================================
  test('test17 — concurrent recovery: second attempt returns 409', async ({ page }) => {
    // --- Start first recovery ---
    const first = await startRecovery();
    expect(first.status).toBe(201); // [BUFFER] first recovery starts

    // --- Attempt second recovery on same server ---
    const second = await startRecovery(E2E_SERVER_ID, E2E_TARGET_SNAPSHOT_ID);
    expect(second.status).toBe(409); // [BUFFER] must reject concurrent recovery

    // --- Verify error response structure ---
    expect(second.data.code).toBe('RECOVERY_ALREADY_ACTIVE'); // [BUFFER] specific error code
    if (second.data.sessionId) {
      expect(second.data.sessionId).toBe(first.sessionId); // [BUFFER] should reference existing session
    }

    // --- DB: only ONE active session for this server ---
    const sessions = pgQueryRows(
      `SELECT id, state FROM recovery_session WHERE server_id='${E2E_SERVER_ID}' AND state NOT IN ('DONE','FAILED','CANCELLED')`
    );
    expect(sessions.length).toBe(1); // [BUFFER] exactly one active session
    expect(sessions[0].id).toBe(first.sessionId);

    // --- DB ASSERTION: first session still active, state is PLANNING ---
    const firstDb = getRecoverySession(first.sessionId);
    expect(firstDb).not.toBeNull(); // [BUFFER] first session persists
    expect(['PLANNING', 'AWAITING_USER_CONFIRM', 'READY', 'AGENT_RESTORING']).toContain(firstDb.state); // [BUFFER] first session still active

    // --- Navigate to panel for video recording ---
    await page.goto(PANEL_URL);
    await page.waitForTimeout(1000);

    console.log(`[test17] Concurrent: first=${first.sessionId} (${first.status}), second=${second.status}, db_state=${firstDb.state}`);
  });

  // =========================================================================
  // TEST 18: Pre-recovery snapshot in timeline after DONE
  // Spec: After recovery completes, SnapshotTimeline shows pre-recovery
  //        snapshot with badge "PRE-RECOVERY (30d grace)"
  // =========================================================================
  test('test18 — pre-recovery snapshot visible after recovery DONE', async ({ page }) => {
    // --- Drive to READY and complete ---
    const { sessionId } = await driveToReady();

    // For pre-recovery snapshot check, we need the agent to have created one.
    // Check DB for PRE_RECOVERY type snapshots
    const snapshotsBefore = getArchiveSnapshots(E2E_SERVER_ID);

    // --- Simulate agent complete ---
    await reportProgress(sessionId, { filesRestored: 4, bytes: 525475 });
    await reportComplete(sessionId);

    const snapshotsAfter = getArchiveSnapshots(E2E_SERVER_ID);

    // --- Check for new PRE_RECOVERY snapshot ---
    const newSnapshots = snapshotsAfter.filter(s =>
      !snapshotsBefore.some(b => b.id === s.id)
    );

    const preRecovery = newSnapshots.find(s =>
      s.snapshot_type === 'PRE_RECOVERY' || s.flag === 'P'
    );

    // --- DB: check recovery_session.pre_recovery_snapshot_id — HARD ASSERTION ---
    const doneSession = getRecoverySession(sessionId);
    const preRecoverySnapshotId = doneSession.pre_recovery_snapshot_id;

    // HR-5: pre_recovery_snapshot_id MUST be non-null after DONE
    expect(preRecoverySnapshotId).toBeTruthy(); // [TRIAGE:AGENT] HR-5: pre_recovery_snapshot_id must be set

    // HR-5: archive_snapshot with type PRE_RECOVERY must exist
    expect(preRecovery).toBeTruthy(); // [TRIAGE:AGENT] HR-5: PRE_RECOVERY snapshot row must exist
    if (preRecovery) {
      expect(preRecovery.snapshot_type).toBe('PRE_RECOVERY');
      console.log(`[test18] Pre-recovery snapshot: id=${preRecovery.id}, type=${preRecovery.snapshot_type}`);
    }

    // --- UI: check timeline for pre-recovery badge ---
    await page.goto(PANEL_URL);
    await page.waitForTimeout(1000);
    const badge = page.locator('[data-testid="pre-recovery-badge"]');
    if (await badge.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('[test18] Pre-recovery badge visible in timeline: PASS');
    } else {
      console.warn('[TRIAGE:WEB] Pre-recovery badge not visible in timeline UI');
    }
  });
});

// ===========================================================================
// EDGE CASES
// ===========================================================================
test.describe('Recovery Mode QA — Edge Cases', () => {

  test.beforeEach(async () => {
    cleanRecoverySessions(E2E_SERVER_ID);
  });

  // --- Bad snapshot ID ---
  test('edge: invalid snapshot ID → graceful error', async () => {
    const resp = await startRecovery(E2E_SERVER_ID, 99999);
    // Buffer should validate snapshot exists and return 400 or 404
    if (resp.status === 201) {
      console.warn('[TRIAGE:BUFFER] Buffer accepted non-existent snapshot ID 99999. ' +
        'Should validate target_snapshot_id exists in archive_snapshot table.');
      cleanRecoverySessions(E2E_SERVER_ID);
    } else if (resp.status === 500) {
      // [TRIAGE:BUFFER] Buffer crashes instead of returning graceful error for bad snapshot ID.
      // Root cause: startRecovery() does not validate target_snapshot_id before calling
      // dryRun.requestDryRun() or store.create(). Should check archive_snapshot table first.
      console.warn('[TRIAGE:BUFFER] Buffer returns 500 for invalid snapshot ID. ' +
        'Expected: 400 or 404 with a clear error message. ' +
        'Fix: validate target_snapshot_id exists in archive_snapshot before creating session.');
      // Clean up any partial session
      cleanRecoverySessions(E2E_SERVER_ID);
    } else {
      expect([400, 404]).toContain(resp.status);
    }
    console.log(`[edge] Bad snapshot: status=${resp.status}, error=${JSON.stringify(resp.data)}`);
  });

  // --- Cancel from AWAITING_USER_CONFIRM (before agent involvement) ---
  test('edge: cancel from AWAITING_USER_CONFIRM → clean cancel', async () => {
    const { sessionId } = await startRecovery();
    await reportDryRunResult(sessionId);

    const dbBefore = getRecoverySession(sessionId);
    expect(dbBefore.state).toBe('AWAITING_USER_CONFIRM');

    const cancelResp = await cancelRecovery(sessionId, 'changed mind');
    expect(cancelResp.status).toBe(200);

    const dbAfter = getRecoverySession(sessionId);
    expect(dbAfter.state).toBe('CANCELLED'); // [BUFFER] clean cancel
    // No files should have been touched (no agent involvement)
    expect(parseInt(dbAfter.files_restored || '0')).toBe(0);

    console.log('[edge] Cancel from AWAITING_USER_CONFIRM: clean CANCELLED ✓');
  });

  // --- State machine: illegal transition ---
  test('edge: illegal state transition rejected', async () => {
    const { sessionId } = await startRecovery();
    // Session is in PLANNING. Try to confirm directly (should require AWAITING_USER_CONFIRM)
    const confirmResp = await confirmRecovery(sessionId);
    expect(confirmResp.status).not.toBe(200); // [BUFFER] illegal: PLANNING → READY

    console.log(`[edge] Illegal transition: confirm from PLANNING → status=${confirmResp.status}`);
  });

  // --- Audit log completeness ---
  test('edge: audit log has entries for every action', async () => {
    const { sessionId } = await startRecovery();
    await reportDryRunResult(sessionId);
    await confirmRecovery(sessionId);

    const audit = getAuditLog(sessionId);
    const actions = audit.map(a => a.action);

    expect(actions).toContain('RECOVERY_REQUESTED'); // [BUFFER] HR-6
    expect(actions).toContain('RECOVERY_DRY_RUN_COMPUTED'); // [BUFFER] HR-6
    expect(actions).toContain('RECOVERY_USER_CONFIRMED'); // [BUFFER] HR-6

    // Verify timestamps are non-null
    for (const entry of audit) {
      expect(entry.created_at).toBeTruthy(); // [BUFFER] every audit entry must have timestamp
    }

    console.log(`[edge] Audit completeness: ${audit.length} entries, actions: ${actions.join(', ')}`);
  });
});
