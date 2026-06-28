/**
 * Local pipeline helpers for the backup-core E2E test.
 *
 * These run INSIDE dedyk LXC 100 (the application container), so the agent,
 * the buffer, PostgreSQL (in docker) and /mnt/storage are all reachable
 * locally — no SSH. This is the counterpart to helpers/dedykConnection.js
 * (which drives the same stack remotely over SSH for the recovery QA suite).
 *
 * Assertions are DB-first (PostgreSQL via `docker exec ... psql`) and
 * files-on-disk (/mnt/storage); UI is secondary.
 */
import { execSync } from 'node:child_process';

const PG_CONTAINER = process.env.PB_PG_CONTAINER || 'properbackup-postgres-1';
const PG_USER = process.env.PB_PG_USER || 'properbackup';
const PG_DB = process.env.PB_PG_DB || 'properbackup';

/** Run a shell command locally, return trimmed stdout. Throws on non-zero. */
export function sh(cmd, { timeout = 120000 } = {}) {
  return execSync(cmd, { timeout, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 }).trim();
}

/** Run a SQL query (base64-piped to avoid quoting issues). Raw aligned output. */
export function pg(sql) {
  const b64 = Buffer.from(sql).toString('base64');
  return sh(
    `echo ${b64} | base64 -d | docker exec -i ${PG_CONTAINER} psql -U ${PG_USER} -d ${PG_DB} -t -A -F '|'`,
  );
}

/** Run a SQL query and return parsed rows as objects given explicit column names. */
export function pgRows(sql, cols) {
  const raw = pg(sql);
  if (!raw) return [];
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l.includes('|'))
    .map((line) => {
      const vals = line.split('|');
      const row = {};
      cols.forEach((c, i) => { row[c] = vals[i] === '' ? null : vals[i]; });
      return row;
    });
}

/** Count archive snapshots for a server. */
export function snapshotCount(serverId) {
  return parseInt(pg(`SELECT count(*) FROM archive_snapshot WHERE server_id='${serverId}'`), 10);
}

/** Fetch a single archive_snapshot row by object_name. */
export function snapshotByObject(serverId, objectName) {
  const rows = pgRows(
    `SELECT id, object_name, flag, size_bytes, sealed_at FROM archive_snapshot ` +
    `WHERE server_id='${serverId}' AND object_name='${objectName}'`,
    ['id', 'object_name', 'flag', 'size_bytes', 'sealed_at'],
  );
  return rows[0] || null;
}
