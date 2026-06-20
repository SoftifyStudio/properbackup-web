/**
 * Recovery Session API client.
 * Communicates with buffer recovery endpoints per user-facing-recovery-spec.md §5.3.
 */

import { bufferBaseUrl } from '../bufferConfig.js';

const BASE = bufferBaseUrl();

function headers(token) {
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** POST /recovery/start — create new recovery session */
export async function startRecovery(serverId, targetSnapshotId, token) {
  const res = await fetch(`${BASE}/recovery/start`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ server_id: serverId, target_snapshot_id: targetSnapshotId }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || data.code), { code: data.code, status: res.status });
  return data;
}

/** GET /recovery/:id — get session state */
export async function getRecoverySession(sessionId, token) {
  const res = await fetch(`${BASE}/recovery/${sessionId}`, { headers: headers(token) });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || data.code), { code: data.code, status: res.status });
  return data;
}

/** POST /recovery/:id/confirm — user confirms DRY RUN preview */
export async function confirmRecovery(sessionId, token) {
  const res = await fetch(`${BASE}/recovery/${sessionId}/confirm`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ user_confirmation: true }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || data.code), { code: data.code, status: res.status });
  return data;
}

/** POST /recovery/:id/cancel — cancel from any non-terminal state */
export async function cancelRecovery(sessionId, token, reason = '') {
  const res = await fetch(`${BASE}/recovery/${sessionId}/cancel`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || data.code), { code: data.code, status: res.status });
  return data;
}

/** GET /recovery/history?server_id=... — past recovery sessions */
export async function getRecoveryHistory(serverId, token) {
  const res = await fetch(`${BASE}/recovery/history?server_id=${encodeURIComponent(serverId)}`, {
    headers: headers(token),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || data.code), { code: data.code, status: res.status });
  return data;
}

/** GET /recovery/active — currently active recovery sessions for user */
export async function getActiveRecoveries(token) {
  const res = await fetch(`${BASE}/recovery/active`, { headers: headers(token) });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || data.code), { code: data.code, status: res.status });
  return data;
}

/** GET /recovery/:id/audit — audit log for session */
export async function getRecoveryAudit(sessionId, token) {
  const res = await fetch(`${BASE}/recovery/${sessionId}/audit`, { headers: headers(token) });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || data.code), { code: data.code, status: res.status });
  return data;
}
