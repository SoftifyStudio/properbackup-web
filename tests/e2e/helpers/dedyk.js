/**
 * Dedyk (OVH Proxmox / LXC 100) connection + assertion helpers for the
 * in-place restore E2E (test02).
 *
 * All real assertions run against CONCRETE state on the server:
 *   - filesystem SHA-256 of restored files (via sha256sum in LXC 100)
 *   - PostgreSQL recovery_session / archive_snapshot rows
 *
 * SSH goes over the VPN host (DEDYK_SSH_HOST, default 10.9.0.1) and then
 * `pct exec 100` into the properbackup container. HTTP (panel/buffer) is
 * reached separately via the public IP because LXC's internal subnet is
 * not routed over the VPN.
 */
import { execSync, spawn } from 'node:child_process';

export const DEDYK_SSH_HOST = process.env.DEDYK_SSH_HOST || '10.9.0.1';
const SSH_PASSWORD = process.env.OVH_DEDICATED_SERVER_PROXMOX_ROOT_PASSWORD || '';

const AGENT_DIR = '/opt/pb-agent-e2e';
const BACKUP_SOURCE = `${AGENT_DIR}/backup-source`;
const CONF_DIR = `${AGENT_DIR}/conf.uipipe`;

/** Single-quote a value for safe embedding in a shell command. */
function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * Run a shell command inside LXC 100 (SSH -> pct exec -> bash), base64-wrapped.
 * The SSH password is passed to sshpass via the SSHPASS env var (`-e`) so it
 * never lands in the command string (no shell-injection edge) nor in `ps`.
 */
export function dedykExec(cmd, { timeout = 60000 } = {}) {
  const b64 = Buffer.from(cmd).toString('base64');
  const ssh =
    `sshpass -e ssh -o StrictHostKeyChecking=no ` +
    `-o ConnectTimeout=15 root@${DEDYK_SSH_HOST} ` +
    `"pct exec 100 -- bash -c 'echo ${b64} | base64 -d | bash'"`;
  return execSync(ssh, {
    timeout,
    encoding: 'utf-8',
    env: { ...process.env, SSHPASS: SSH_PASSWORD },
  }).trim();
}

/**
 * Run a SQL query in the buffer Postgres; returns raw psql text.
 * Values are passed as psql variables (`-v name=value`) and referenced in SQL
 * as `:'name'`, which performs proper SQL-literal quoting/escaping rather than
 * raw string interpolation.
 */
export function pgQuery(sql, { tuples = false, params = {} } = {}) {
  const flags = tuples ? '-t -A' : '';
  const varFlags = Object.entries(params)
    .map(([k, v]) => `-v ${k}=${shellQuote(v)}`)
    .join(' ');
  const b64 = Buffer.from(sql).toString('base64');
  return dedykExec(
    `echo ${b64} | base64 -d | docker exec -i properbackup-postgres-1 ` +
      `psql -U properbackup -d properbackup ${flags} ${varFlags}`,
  );
}

/** Single scalar value from a query. */
export function pgScalar(sql, opts = {}) {
  return pgQuery(sql, { ...opts, tuples: true }).trim();
}

export function getRecoverySession(sessionId) {
  const raw = pgQuery(
    `SELECT state, target_snapshot_id, pre_recovery_snapshot_id, dry_run_files_to_restore, ` +
      `dry_run_files_to_delete, files_restored, files_deleted ` +
      `FROM recovery_session WHERE id=:'sessionId'`,
    { tuples: true, params: { sessionId } },
  );
  const line = raw.split('\n').map((l) => l.trim()).find(Boolean);
  if (!line) return null;
  const [state, targetSnap, preSnap, dRestore, dDelete, fRestored, fDeleted] = line
    .split('|')
    .map((v) => v.trim());
  return {
    state,
    targetSnapshotId: targetSnap || null,
    preRecoverySnapshotId: preSnap || null,
    dryRunFilesToRestore: dRestore,
    dryRunFilesToDelete: dDelete,
    filesRestored: fRestored,
    filesDeleted: fDeleted,
  };
}

/** Latest archive snapshot id for a server (optionally filtered by type/flag). */
export function latestSnapshotId(serverId, { type = null, flag = null } = {}) {
  const params = { serverId };
  let typeClause = '';
  if (type) {
    typeClause = ` AND snapshot_type=:'stype'`;
    params.stype = type;
  }
  let flagClause = '';
  if (flag) {
    flagClause = ` AND flag=:'sflag'`;
    params.sflag = flag;
  }
  const v = pgScalar(
    `SELECT id FROM archive_snapshot WHERE server_id=:'serverId'${typeClause}${flagClause} ` +
      `ORDER BY id DESC LIMIT 1`,
    { params },
  );
  return v ? parseInt(v, 10) : null;
}

/**
 * Cancel any stale active recovery sessions for a server so a fresh run does
 * not collide with RECOVERY_ALREADY_ACTIVE. Only touches non-terminal rows.
 */
export function cancelActiveRecoverySessions(serverId) {
  pgQuery(
    `UPDATE recovery_session SET state='CANCELLED' WHERE server_id=:'serverId' ` +
      `AND state NOT IN ('DONE','FAILED','CANCELLED')`,
    { params: { serverId } },
  );
}

export function snapshotType(snapshotId) {
  return pgScalar(`SELECT snapshot_type FROM archive_snapshot WHERE id=:'snapshotId'`, {
    params: { snapshotId },
  });
}

/** Map of relative filename -> sha256 for every file in backup-source. */
export function backupSourceShas() {
  const out = dedykExec(
    `cd ${BACKUP_SOURCE} && find . -maxdepth 1 -type f -printf '%P\\n' | sort | ` +
      `while read f; do echo "$f $(sha256sum "$f" | cut -d' ' -f1)"; done`,
  );
  const map = {};
  for (const line of out.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const [name, sha] = line.split(/\s+/);
    map[name] = sha;
  }
  return map;
}

export function listBackupSourceFiles() {
  const out = dedykExec(
    `cd ${BACKUP_SOURCE} && find . -maxdepth 1 -type f -printf '%P\\n' | sort`,
  );
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

/**
 * Reset backup-source to a deterministic baseline (state S1).
 * Also clears prior agent recovery state and any stray temp files.
 */
export function resetBackupSourceBaseline() {
  dedykExec(
    [
      `rm -rf ${BACKUP_SOURCE}`,
      `mkdir -p ${BACKUP_SOURCE}`,
      `printf 'canary-ORIGINAL-S1\\nline2-original\\n' > ${BACKUP_SOURCE}/canary.txt`,
      `printf 'nested readme original\\n' > ${BACKUP_SOURCE}/nested-readme.txt`,
      // deterministic 128k binary (fixed seed) so SHA is stable across resets
      `head -c 131072 /dev/zero | tr '\\0' 'A' > ${BACKUP_SOURCE}/random-128k.bin`,
      // wipe agent recovery state AND the backup index so each run produces a
      // fresh FULL S1 snapshot (otherwise incremental backup may skip it)
      `rm -f ${AGENT_DIR}/state/recovery_state*.json 2>/dev/null || true`,
      `rm -f ${AGENT_DIR}/state/*.state.json 2>/dev/null || true`,
      `rm -f ${BACKUP_SOURCE}/.recovery-*.tmp 2>/dev/null || true`,
    ].join(' && '),
  );
}

/**
 * Mutate backup-source AFTER S1 to "bzdury":
 *  - modify canary.txt (content changed)
 *  - add brand-new file (must be DELETED by time-travel restore)
 *  - delete nested-readme.txt (must be RE-CREATED by restore)
 */
export function mutateBackupSourceAfterS1() {
  dedykExec(
    [
      `printf 'GARBAGE-CORRUPTED-AFTER-S1-xxxxx\\n' > ${BACKUP_SOURCE}/canary.txt`,
      `printf 'this file did not exist in S1\\n' > ${BACKUP_SOURCE}/file-added-after-s1.txt`,
      `rm -f ${BACKUP_SOURCE}/nested-readme.txt`,
    ].join(' && '),
  );
}

/**
 * Run the real agent once (backup cycle + a single recovery poll+execute).
 * Returns combined stdout/stderr.
 */
export function runAgentOnce({ timeout = 180000 } = {}) {
  return dedykExec(
    `cd ${AGENT_DIR} && rm -f conf.uipipe/.agent.lock conf.d/.agent.lock 2>/dev/null; ` +
      `java -cp properbackup-agent-all.jar ` +
      `pl.danielniemiec.properbackup.agent.AgentMain ` +
      `--config ${CONF_DIR}/global.yml --conf-dir ${CONF_DIR} --once --headless 2>&1 || true`,
    { timeout },
  );
}

/**
 * Run the real agent once in the BACKGROUND (non-blocking). Returns a promise
 * that resolves when the agent process exits. Unlike runAgentOnce (execSync,
 * which blocks the Node event loop), this lets Playwright keep watching the UI
 * live while the agent polls + executes the recovery — so the progress overlay
 * transitions AGENT_RESTORING -> VERIFYING -> DONE are observable on screen.
 */
export function runAgentOnceBackground({ timeout = 180000 } = {}) {
  const inner =
    `cd ${AGENT_DIR} && rm -f conf.uipipe/.agent.lock conf.d/.agent.lock 2>/dev/null; ` +
    `java -cp properbackup-agent-all.jar ` +
    `pl.danielniemiec.properbackup.agent.AgentMain ` +
    `--config ${CONF_DIR}/global.yml --conf-dir ${CONF_DIR} --once --headless 2>&1 || true`;
  const b64 = Buffer.from(inner).toString('base64');
  const remote = `pct exec 100 -- bash -c 'echo ${b64} | base64 -d | bash'`;
  const child = spawn(
    'sshpass',
    ['-e', 'ssh', '-o', 'StrictHostKeyChecking=no',
      '-o', 'ConnectTimeout=15', `root@${DEDYK_SSH_HOST}`, remote],
    { stdio: 'ignore', env: { ...process.env, SSHPASS: SSH_PASSWORD } },
  );
  const promise = new Promise((resolve) => {
    const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /**/ } resolve('timeout'); }, timeout);
    child.on('exit', (code) => { clearTimeout(t); resolve(code); });
    child.on('error', () => { clearTimeout(t); resolve('error'); });
  });
  return promise;
}

/** Poll recovery_session.state until it reaches one of targetStates or times out. */
export function pollSessionState(sessionId, targetStates, { timeoutMs = 60000, intervalMs = 2000 } = {}) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    last = getRecoverySession(sessionId);
    if (last && targetStates.includes(last.state)) return last;
    execSync(`sleep ${Math.ceil(intervalMs / 1000)}`);
  }
  return last;
}
