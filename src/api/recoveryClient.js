import { bufferBaseUrl } from '../bufferConfig.js';

const BASE_URL = bufferBaseUrl();

function headers(token) {
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function startRecovery(serverId, targetSnapshotId, token) {
  const res = await fetch(`${BASE_URL}/recovery/start`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ server_id: serverId, target_snapshot_id: targetSnapshotId }),
  });
  if (res.status === 409) {
    const data = await res.json();
    throw Object.assign(new Error('Recovery already active'), { code: 'RECOVERY_ALREADY_ACTIVE', data });
  }
  if (!res.ok) throw new Error(`start recovery failed: ${res.status}`);
  return res.json();
}

export async function fetchRecoverySession(sessionId, token) {
  const res = await fetch(`${BASE_URL}/recovery/${encodeURIComponent(sessionId)}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`fetch session failed: ${res.status}`);
  return res.json();
}

export async function confirmRecovery(sessionId, token) {
  const res = await fetch(`${BASE_URL}/recovery/${encodeURIComponent(sessionId)}/confirm`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ user_confirmation: true, cold_tier: false }),
  });
  if (!res.ok) throw new Error(`confirm failed: ${res.status}`);
  return res.json();
}

export async function cancelRecovery(sessionId, reason, token) {
  const res = await fetch(`${BASE_URL}/recovery/${encodeURIComponent(sessionId)}/cancel`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ reason: reason || '' }),
  });
  if (!res.ok) throw new Error(`cancel failed: ${res.status}`);
  return res.json();
}

export async function fetchRecoveryAudit(sessionId, token, limit = 200) {
  const res = await fetch(`${BASE_URL}/recovery/${encodeURIComponent(sessionId)}/audit?limit=${limit}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`audit failed: ${res.status}`);
  return res.json();
}

export async function fetchRecoveryHistory(serverId, token, limit = 100) {
  const res = await fetch(`${BASE_URL}/recovery/history?server_id=${encodeURIComponent(serverId)}&limit=${limit}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`history failed: ${res.status}`);
  return res.json();
}

export async function fetchActiveRecoveries(token) {
  const res = await fetch(`${BASE_URL}/recovery/history?active=true`, {
    headers: headers(token),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.sessions || []).filter(s => !['DONE', 'FAILED', 'CANCELLED'].includes(s.state));
}

export function createRecoverySSE(serverId, token) {
  const url = `${BASE_URL}/sse/stream/${encodeURIComponent(serverId)}?token=${encodeURIComponent(token)}`;
  return new EventSource(url);
}
