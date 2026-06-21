/**
 * Recovery E2E test helpers — API + UI interaction.
 * 
 * Uses REAL buffer API (not mocks) to drive recovery sessions,
 * then verifies state via DIRECT DB queries (not UI state).
 */
import { BUFFER_URL } from './dedykConnection.js';

// JWT for e2e-user-001 (dev secret 'dev-jwt-secret-change-in-prod', 1-year expiry)
const JWT_TOKEN = process.env.E2E_JWT_TOKEN ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMmUtdXNlci0wMDEiLCJlbWFpbCI6ImUyZS10ZXN0QHByb3BlcmJhY2t1cC5wbCIsInNhIjpmYWxzZSwiaWF0IjoxNzgyMDQzNTkyLCJleHAiOjE4MTM1Nzk1OTJ9.sifpSPdgjLJMqUSPI8utsaQxUOxnrl2nD9mzi-E4hm0';

const E2E_SERVER_ID = process.env.E2E_SERVER_ID || '194efe2e-9309-4376-a240-6ccdc6afa188';
const E2E_TARGET_SNAPSHOT_ID = parseInt(process.env.E2E_TARGET_SNAPSHOT_ID || '5', 10);

/**
 * POST to buffer API with JWT auth.
 */
export async function bufferPost(endpoint, body = {}) {
  const resp = await fetch(`${BUFFER_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JWT_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  return { status: resp.status, data: await resp.json().catch(() => ({})) };
}

/**
 * GET from buffer API with JWT auth.
 */
export async function bufferGet(endpoint) {
  const resp = await fetch(`${BUFFER_URL}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${JWT_TOKEN}` },
  });
  return { status: resp.status, data: await resp.json().catch(() => ({})) };
}

/**
 * POST to agent endpoints (no auth required — agent uses X-Server-Id header).
 */
export async function agentPost(endpoint, body = {}) {
  const resp = await fetch(`${BUFFER_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: resp.status, data: await resp.json().catch(() => ({})) };
}

/**
 * Start a recovery session via buffer API.
 * Returns { sessionId, status, data }.
 */
export async function startRecovery(serverId = E2E_SERVER_ID, snapshotId = E2E_TARGET_SNAPSHOT_ID) {
  const { status, data } = await bufferPost('/recovery/start', {
    server_id: serverId,
    target_snapshot_id: snapshotId,
  });
  return { sessionId: data.session_id, status, data };
}

/**
 * Get recovery session status from buffer API.
 */
export async function getRecoveryStatus(sessionId) {
  return bufferGet(`/recovery/${sessionId}`);
}

/**
 * Simulate agent DRY RUN result report.
 */
export async function reportDryRunResult(sessionId, {
  filesToRestore = 4,
  filesToDelete = 0,
  filesUnchanged = 0,
  totalBytes = 525475,
  sampleRestore = ['README.txt', 'binary-sample.bin', 'file1.txt', 'file2.txt'],
  sampleDelete = [],
  criticalProtected = 0,
  estimatedDurationSec = 5,
} = {}) {
  return agentPost(`/agent/recovery/${sessionId}/dry_run_result`, {
    files_to_restore: filesToRestore,
    files_to_delete: filesToDelete,
    files_unchanged: filesUnchanged,
    total_bytes: totalBytes,
    sample_restore: sampleRestore,
    sample_delete: sampleDelete,
    critical_protected: criticalProtected,
    estimated_duration_seconds: estimatedDurationSec,
  });
}

/**
 * Confirm recovery with cold_tier flag.
 */
export async function confirmRecovery(sessionId, { coldTier = false } = {}) {
  return bufferPost(`/recovery/${sessionId}/confirm`, {
    user_confirmation: true,
    cold_tier: coldTier,
  });
}

/**
 * Cancel a recovery session.
 */
export async function cancelRecovery(sessionId, reason = '') {
  return bufferPost(`/recovery/${sessionId}/cancel`, { reason });
}

/**
 * Report agent progress.
 */
export async function reportProgress(sessionId, { filesRestored = 0, filesDeleted = 0, bytes = 0 } = {}) {
  return agentPost(`/agent/recovery/${sessionId}/progress`, {
    files_restored_delta: filesRestored,
    files_deleted_delta: filesDeleted,
    bytes_delta: bytes,
  });
}

/**
 * Report agent complete.
 */
export async function reportComplete(sessionId, { success = true, verification = 'OK', error = '' } = {}) {
  return agentPost(`/agent/recovery/${sessionId}/complete`, {
    success,
    verification,
    ...(error ? { error } : {}),
  });
}

/**
 * Agent poll for recovery commands.
 */
export async function agentPoll(serverId = E2E_SERVER_ID) {
  const resp = await fetch(`${BUFFER_URL}/agent/recovery/poll`, {
    headers: { 'X-Server-Id': serverId },
  });
  return { status: resp.status, data: await resp.json().catch(() => ({})) };
}

/**
 * Drive full happy path: start → dry_run → confirm → READY.
 * Returns { sessionId, confirmLatencyMs }.
 * Stops at READY — caller decides what happens next (agent simulation or real agent).
 */
export async function driveToReady(serverId = E2E_SERVER_ID, snapshotId = E2E_TARGET_SNAPSHOT_ID) {
  const { sessionId } = await startRecovery(serverId, snapshotId);
  await reportDryRunResult(sessionId);
  const confirmStart = Date.now();
  await confirmRecovery(sessionId);
  const confirmLatencyMs = Date.now() - confirmStart;
  return { sessionId, confirmLatencyMs };
}

/**
 * Navigate to recovery UI via Playwright page (clicks real app).
 */
export async function startRecoveryViaUI(page, serverId, snapshotId) {
  await page.goto(`/panel/servers/${serverId}/timeline`);
  const restoreBtn = page.locator(`[data-testid="snapshot-${snapshotId}"] [data-testid="restore-to-here-btn"]`);
  if (await restoreBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await restoreBtn.click();
    await page.waitForSelector('[data-testid="recovery-confirmation-modal"]', { timeout: 10000 });
    return true;
  }
  return false;
}

/**
 * Confirm recovery via UI (DRY RUN checkbox + Start button).
 */
export async function confirmRecoveryViaUI(page) {
  const checkbox = page.locator('[data-testid="recovery-acknowledge-checkbox"]');
  if (await checkbox.isVisible({ timeout: 5000 }).catch(() => false)) {
    await checkbox.check();
    await page.click('[data-testid="recovery-start-btn"]');
    return true;
  }
  return false;
}

export { JWT_TOKEN, E2E_SERVER_ID, E2E_TARGET_SNAPSHOT_ID };
