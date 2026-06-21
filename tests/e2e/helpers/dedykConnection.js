/**
 * Dedyk (OVH) connection helpers for E2E testing.
 * Executes commands on dedyk LXC 100 via SSH and provides
 * direct PostgreSQL query access for REAL DB assertions.
 *
 * IMPORTANT: Tests assert on CONCRETE DB state, not UI claims.
 */
import { execSync } from 'child_process';

const DEDYK_HOST = process.env.DEDYK_HOST || '51.255.93.127';
const DEDYK_PASSWORD = process.env.OVH_DEDICATED_SERVER_PROXMOX_ROOT_PASSWORD || '';
const BUFFER_URL = process.env.BUFFER_URL || `http://${DEDYK_HOST}:8080`;
const PANEL_URL = process.env.PANEL_URL || `http://${DEDYK_HOST}:80`;

/**
 * Run a shell command inside dedyk LXC 100 (via SSH + pct exec).
 * Uses base64 encoding to avoid nested quoting issues (SSH → pct → bash → docker).
 * Returns stdout as string. Throws on non-zero exit.
 */
export function dedykExec(cmd, { timeout = 30000 } = {}) {
  const b64 = Buffer.from(cmd).toString('base64');
  const sshCmd = `sshpass -p "${DEDYK_PASSWORD}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@${DEDYK_HOST} "pct exec 100 -- bash -c 'echo ${b64} | base64 -d | bash'"`;
  return execSync(sshCmd, { timeout, encoding: 'utf-8' }).trim();
}

/**
 * Run a PostgreSQL query on dedyk and return raw output.
 * SQL is base64-encoded end-to-end to avoid quoting hell.
 */
export function pgQuery(sql, { tuples = false } = {}) {
  const flags = tuples ? '-t' : '';
  const b64Sql = Buffer.from(sql).toString('base64');
  const cmd = `echo ${b64Sql} | base64 -d | docker exec -i properbackup-postgres-1 psql -U properbackup -d properbackup ${flags}`;
  return dedykExec(cmd);
}

/**
 * Run a PostgreSQL query and return parsed rows as objects.
 */
export function pgQueryRows(sql) {
  const raw = pgQuery(sql);
  const lines = raw.split('\n').filter(l => l.trim());
  if (lines.length < 3) return []; // header + separator + data minimum

  const headerLine = lines[0];
  const cols = headerLine.split('|').map(c => c.trim());
  const dataLines = lines.slice(2).filter(l => !l.startsWith('(') && l.includes('|'));

  return dataLines.map(line => {
    const vals = line.split('|').map(v => v.trim());
    const row = {};
    cols.forEach((col, i) => {
      row[col] = vals[i] === '' ? null : vals[i];
    });
    return row;
  });
}

/**
 * Get a recovery session by ID from the DB.
 */
export function getRecoverySession(sessionId) {
  const rows = pgQueryRows(
    `SELECT * FROM recovery_session WHERE id='${sessionId}'`
  );
  return rows[0] || null;
}

/**
 * Get recovery audit log entries for a session.
 */
export function getAuditLog(sessionId) {
  return pgQueryRows(
    `SELECT action, detail, created_at FROM recovery_audit_log WHERE recovery_session_id='${sessionId}' ORDER BY created_at ASC`
  );
}

/**
 * Get archive snapshots for a server (to check PRE_RECOVERY snapshots).
 */
export function getArchiveSnapshots(serverId) {
  return pgQueryRows(
    `SELECT id, server_id, object_name, flag, snapshot_type, sealed_at FROM archive_snapshot WHERE server_id='${serverId}' ORDER BY sealed_at DESC`
  );
}

/**
 * Clean up recovery sessions for a server (test isolation).
 * Handles FK: archive_snapshot.pre_recovery_session_id references recovery_session.
 */
export function cleanRecoverySessions(serverId) {
  // First null out FK references in archive_snapshot to avoid constraint violations
  pgQuery(`UPDATE archive_snapshot SET pre_recovery_session_id = NULL WHERE pre_recovery_session_id IN (SELECT id FROM recovery_session WHERE server_id='${serverId}')`);
  pgQuery(`DELETE FROM recovery_session WHERE server_id='${serverId}'`);
}

/**
 * Check if a file exists on dedyk filesystem.
 */
export function fileExistsOnDedyk(path) {
  try {
    dedykExec(`test -f '${path}' && echo EXISTS`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Compute SHA-256 of a file on dedyk.
 */
export function sha256OnDedyk(path) {
  const out = dedykExec(`sha256sum '${path}'`);
  return out.split(/\s+/)[0]; // full 64-char hex
}

/**
 * Delete a file from dedyk filesystem.
 */
export function deleteFileOnDedyk(path) {
  try {
    dedykExec(`rm -f '${path}'`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete all files in a directory on dedyk (but keep the directory).
 */
export function clearDirectoryOnDedyk(dirPath) {
  try {
    dedykExec(`find '${dirPath}' -maxdepth 1 -type f -delete`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Trigger the real agent on dedyk (--once mode).
 * Returns agent stdout/stderr. Timeout 120s for restore.
 */
export function triggerAgentOnDedyk() {
  return dedykExec(
    'cd /opt/pb-agent-e2e && java -jar properbackup-agent-all.jar --config conf.d/global.yml --conf-dir conf.d --once --headless 2>&1 || true',
    { timeout: 120000 }
  );
}

/**
 * Poll recovery_session.state until it matches target or timeout.
 * Returns final session row.
 */
export function pollSessionState(sessionId, targetStates, { timeoutMs = 90000, intervalMs = 2000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const session = getRecoverySession(sessionId);
    if (session && targetStates.includes(session.state)) {
      return session;
    }
    // Blocking sleep via shell (sync polling)
    try { dedykExec('sleep 1', { timeout: 5000 }); } catch {}
  }
  // Return last state even on timeout
  return getRecoverySession(sessionId);
}

export { DEDYK_HOST, BUFFER_URL, PANEL_URL };
