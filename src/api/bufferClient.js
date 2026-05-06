/**
 * Client for the ProperBackup Buffer Service (JWT-protected routes).
 * @see ../bufferConfig.js — VITE_BUFFER_URL or dev proxy `/api`.
 */

import { bufferBaseUrl } from '../bufferConfig.js';

const BASE_URL = bufferBaseUrl();

function sessionHeaders(sessionToken) {
  if (!sessionToken) {
    throw new Error('Not authenticated');
  }
  return { Authorization: `Bearer ${sessionToken}` };
}

/**
 * Downloads a single .enc file as ArrayBuffer (for browser-side decrypt).
 * Requires panel JWT — same as other /objects/* calls on the buffer.
 */
export async function downloadObject(objectName, sessionToken) {
  const res = await fetch(`${BASE_URL}/objects/${encodeURIComponent(objectName)}`, {
    headers: sessionHeaders(sessionToken),
  });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  return res.arrayBuffer();
}

/** Force-flush all pending inbox chunks (privileged). */
export async function forceFlush(sessionToken) {
  const res = await fetch(`${BASE_URL}/flush`, {
    method: 'POST',
    headers: { ...sessionHeaders(sessionToken), 'Content-Length': '0' },
  });
  if (!res.ok) throw new Error(`flush failed: ${res.status}`);
  return res.text();
}

/** Paginated live file index + configured roots (JWT). */
export async function fetchInventory(serverId, sessionToken, page = 1, pageSize = 1000) {
  const u = new URL(`${BASE_URL}/servers/${encodeURIComponent(serverId)}/inventory`);
  u.searchParams.set('page', String(page));
  u.searchParams.set('pageSize', String(pageSize));
  const res = await fetch(u, { headers: sessionHeaders(sessionToken) });
  if (!res.ok) throw new Error(`inventory failed: ${res.status}`);
  return res.json();
}

/** Minimal inventory page (pageSize 1) for frequent agent-status / counts polling. */
export async function fetchInventoryMeta(serverId, sessionToken) {
  return fetchInventory(serverId, sessionToken, 1, 1);
}

/** Append-only file status history (JWT). */
export async function fetchFileEvents(serverId, sessionToken, query = {}) {
  const u = new URL(`${BASE_URL}/servers/${encodeURIComponent(serverId)}/file-events`);
  if (query.path) u.searchParams.set('path', query.path);
  if (query.prefix) u.searchParams.set('prefix', query.prefix);
  if (query.status) u.searchParams.set('status', query.status);
  if (query.limit != null) u.searchParams.set('limit', String(query.limit));
  if (query.offset != null) u.searchParams.set('offset', String(query.offset));
  const res = await fetch(u, { headers: sessionHeaders(sessionToken) });
  if (!res.ok) throw new Error(`file-events failed: ${res.status}`);
  return res.json();
}

/** Sealed archive objects metadata (JWT). */
export async function fetchArchiveSnapshots(serverId, sessionToken, query = {}) {
  const u = new URL(`${BASE_URL}/servers/${encodeURIComponent(serverId)}/archive-snapshots`);
  if (query.pathId) u.searchParams.set('pathId', query.pathId);
  if (query.limit != null) u.searchParams.set('limit', String(query.limit));
  const res = await fetch(u, { headers: sessionHeaders(sessionToken) });
  if (!res.ok) throw new Error(`archive-snapshots failed: ${res.status}`);
  return res.json();
}
