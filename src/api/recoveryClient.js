/**
 * Client for the ProperBackup Recovery Session API (/recovery/* endpoints).
 * Maps to buffer endpoints defined in RecoveryHandler.kt.
 */
import { bufferBaseUrl } from '../bufferConfig.js';

const BASE_URL = bufferBaseUrl();

function headers(token) {
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** POST /recovery/start — create a new recovery session */
export async function startRecovery(token, serverId, targetSnapshotId, selectedPaths = null) {
  const payload = { server_id: serverId, target_snapshot_id: targetSnapshotId };
  if (selectedPaths && selectedPaths.length > 0) {
    payload.selected_paths = selectedPaths;
  }
  const res = await fetch(`${BASE_URL}/recovery/start`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(payload),
  });
  if (res.status === 409) {
    const data = await res.json();
    throw Object.assign(new Error('Recovery already active'), { code: 'RECOVERY_ALREADY_ACTIVE', sessionId: data.sessionId });
  }
  if (!res.ok) throw new Error(`start recovery failed: ${res.status}`);
  return res.json();
}

/** GET /recovery/:id — get session state + dry run + progress */
export async function fetchRecoverySession(token, sessionId) {
  const res = await fetch(`${BASE_URL}/recovery/${encodeURIComponent(sessionId)}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`fetch recovery session failed: ${res.status}`);
  return res.json();
}

/** POST /recovery/:id/confirm — user confirms dry run */
export async function confirmRecovery(token, sessionId, coldTier = false) {
  const res = await fetch(`${BASE_URL}/recovery/${encodeURIComponent(sessionId)}/confirm`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ user_confirmation: true, cold_tier: coldTier }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data.code || `confirm failed: ${res.status}`), data);
  }
  return res.json();
}

/** POST /recovery/:id/cancel — cancel recovery */
export async function cancelRecovery(token, sessionId, reason = '') {
  const res = await fetch(`${BASE_URL}/recovery/${encodeURIComponent(sessionId)}/cancel`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data.code || `cancel failed: ${res.status}`), data);
  }
  return res.json();
}

/** GET /recovery/history?server_id= — past recoveries for a server */
export async function fetchRecoveryHistory(token, serverId, limit = 100) {
  const u = new URL(`${BASE_URL}/recovery/history`, window.location.origin);
  u.searchParams.set('server_id', serverId);
  u.searchParams.set('limit', String(limit));
  const res = await fetch(u, { headers: headers(token) });
  if (!res.ok) throw new Error(`recovery history failed: ${res.status}`);
  return res.json();
}

/** GET /recovery/:id/audit — audit log entries for a session */
export async function fetchRecoveryAudit(token, sessionId, limit = 200) {
  const u = new URL(`${BASE_URL}/recovery/${encodeURIComponent(sessionId)}/audit`, window.location.origin);
  u.searchParams.set('limit', String(limit));
  const res = await fetch(u, { headers: headers(token) });
  if (!res.ok) throw new Error(`recovery audit failed: ${res.status}`);
  return res.json();
}

/** Fetch all active recovery sessions for the current user */
export async function fetchActiveRecoveries(token) {
  const res = await fetch(`${BASE_URL}/recovery/history`, {
    headers: headers(token),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const sessions = data.sessions ?? data ?? [];
  return sessions.filter(s => !['DONE', 'FAILED', 'CANCELLED'].includes(s.state));
}
