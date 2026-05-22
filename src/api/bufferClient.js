/**
 * Client for the ProperBackup Buffer Service (JWT-protected routes).
 * @see ../bufferConfig.js — VITE_BUFFER_URL or dev proxy `/api`.
 */

import { bufferBaseUrl } from '../bufferConfig.js';

const BASE_URL = bufferBaseUrl();

function resolveUrl(path) {
  try {
    return new URL(path);
  } catch {
    return new URL(path, window.location.origin);
  }
}

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
export async function fetchInventory(serverId, sessionToken, page = 1, pageSize = 1000, sort = 'path') {
  const u = resolveUrl(`${BASE_URL}/servers/${encodeURIComponent(serverId)}/inventory`);
  u.searchParams.set('page', String(page));
  u.searchParams.set('pageSize', String(pageSize));
  if (sort !== 'path') u.searchParams.set('sort', sort);
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
  const u = resolveUrl(`${BASE_URL}/servers/${encodeURIComponent(serverId)}/file-events`);
  if (query.path) u.searchParams.set('path', query.path);
  if (query.prefix) u.searchParams.set('prefix', query.prefix);
  if (query.status) u.searchParams.set('status', query.status);
  if (query.limit != null) u.searchParams.set('limit', String(query.limit));
  if (query.offset != null) u.searchParams.set('offset', String(query.offset));
  const res = await fetch(u, { headers: sessionHeaders(sessionToken) });
  if (!res.ok) throw new Error(`file-events failed: ${res.status}`);
  return res.json();
}

/** Lightweight inventory summary for fast polling (agent status, file/root counts). */
export async function fetchInventorySummary(serverId, sessionToken) {
  const u = resolveUrl(`${BASE_URL}/health/inventory-summary`);
  u.searchParams.set('serverId', serverId);
  const res = await fetch(u, { headers: sessionHeaders(sessionToken) });
  if (!res.ok) throw new Error(`inventory-summary failed: ${res.status}`);
  return res.json();
}

/** Fetch subscription / trial status (JWT). */
export async function fetchSubscription(sessionToken) {
  const res = await fetch(`${BASE_URL}/account/subscription`, {
    headers: sessionHeaders(sessionToken),
  });
  if (!res.ok) throw new Error(`subscription failed: ${res.status}`);
  return res.json();
}

/** File states at a given point in time (time-travel). */
export async function fetchFileStatesAt(serverId, sessionToken, timestamp, page = 1, pageSize = 1000, sort = 'path') {
  const u = resolveUrl(`${BASE_URL}/servers/${encodeURIComponent(serverId)}/file-states-at`);
  u.searchParams.set('ts', timestamp);
  u.searchParams.set('page', String(page));
  u.searchParams.set('pageSize', String(pageSize));
  if (sort !== 'path') u.searchParams.set('sort', sort);
  const res = await fetch(u, { headers: sessionHeaders(sessionToken) });
  if (!res.ok) throw new Error(`file-states-at failed: ${res.status}`);
  return res.json();
}

/** Agent CPU/RAM metrics for monitoring dashboard (JWT). */
export async function fetchMetrics(serverId, sessionToken, from, to, limit = 1000) {
  const u = resolveUrl(`${BASE_URL}/servers/${encodeURIComponent(serverId)}/metrics`);
  if (from) u.searchParams.set('from', from);
  if (to) u.searchParams.set('to', to);
  if (limit !== 1000) u.searchParams.set('limit', String(limit));
  const res = await fetch(u, { headers: sessionHeaders(sessionToken) });
  if (!res.ok) throw new Error(`metrics failed: ${res.status}`);
  return res.json();
}

/** Recent activity history (logs + file events + agent status) for Activity Log. */
export async function fetchActivity(serverId, sessionToken, limit = 100) {
  const u = resolveUrl(`${BASE_URL}/servers/${encodeURIComponent(serverId)}/activity`);
  u.searchParams.set('limit', String(limit));
  const res = await fetch(u, { headers: sessionHeaders(sessionToken) });
  if (!res.ok) throw new Error(`activity failed: ${res.status}`);
  return res.json();
}

/** Verification results and summary (JWT). */
export async function fetchVerification(serverId, sessionToken, limit = 20) {
  const u = resolveUrl(`${BASE_URL}/servers/${encodeURIComponent(serverId)}/verification`);
  u.searchParams.set('limit', String(limit));
  const res = await fetch(u, { headers: sessionHeaders(sessionToken) });
  if (!res.ok) throw new Error(`verification failed: ${res.status}`);
  return res.json();
}

/** Download audit report as PDF (JWT). */
export async function downloadAuditReport(serverId, sessionToken) {
  const res = await fetch(`${BASE_URL}/servers/${encodeURIComponent(serverId)}/audit-report`, {
    headers: sessionHeaders(sessionToken),
  });
  if (!res.ok) throw new Error(`audit-report failed: ${res.status}`);
  return res.blob();
}

/** Redeem a gift code to activate subscription (JWT). */
export async function redeemGiftCode(code, sessionToken) {
  const res = await fetch(`${BASE_URL}/payment/redeem-gift`, {
    method: 'POST',
    headers: { ...sessionHeaders(sessionToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data.error;
    throw err;
  }
  return data;
}

/** Validate a promo code without marking as used (JWT). */
export async function validatePromoCode(code, sessionToken) {
  const res = await fetch(`${BASE_URL}/payment/validate-promo`, {
    method: 'POST',
    headers: { ...sessionHeaders(sessionToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`validate-promo failed: ${res.status}`);
  return res.json();
}

/** Create Stripe Checkout session with payment mode (prorated + promo discounts). */
export async function createStripeCheckout(plan, sessionToken, promoCode) {
  const res = await fetch(`${BASE_URL}/payment/stripe/checkout`, {
    method: 'POST',
    headers: { ...sessionHeaders(sessionToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, promoCode: promoCode || undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

/** Get Stripe publishable key from backend. */
export async function fetchStripePublicKey(sessionToken) {
  const res = await fetch(`${BASE_URL}/payment/stripe/public-key`, {
    headers: sessionHeaders(sessionToken),
  });
  if (!res.ok) throw new Error(`stripe public-key failed: ${res.status}`);
  return res.json();
}

/** Get masked card info for user's payment method. */
export async function fetchCardInfo(sessionToken) {
  const res = await fetch(`${BASE_URL}/payment/stripe/card-info`, {
    headers: sessionHeaders(sessionToken),
  });
  if (!res.ok) throw new Error(`card-info failed: ${res.status}`);
  return res.json();
}

/** Cancel subscription renewal (via Stripe API). */
export async function cancelSubscription(sessionToken) {
  const res = await fetch(`${BASE_URL}/payment/stripe/cancel-subscription`, {
    method: 'POST',
    headers: { ...sessionHeaders(sessionToken), 'Content-Length': '0' },
  });
  if (!res.ok) throw new Error(`cancel-subscription failed: ${res.status}`);
  return res.json();
}

/** Admin: list promo codes (JWT, admin only). */
export async function fetchPromoCodes(sessionToken) {
  const res = await fetch(`${BASE_URL}/admin/promo-codes`, {
    headers: sessionHeaders(sessionToken),
  });
  if (!res.ok) throw new Error(`promo-codes failed: ${res.status}`);
  return res.json();
}

/** Admin: create promo code (JWT, admin only). */
export async function createPromoCode(data, sessionToken) {
  const res = await fetch(`${BASE_URL}/admin/promo-codes`, {
    method: 'POST',
    headers: { ...sessionHeaders(sessionToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`create promo-code failed: ${res.status}`);
  return res.json();
}

/** Admin: deactivate promo code (JWT, admin only). */
export async function deactivatePromoCode(id, sessionToken) {
  const res = await fetch(`${BASE_URL}/admin/promo-codes/${id}`, {
    method: 'DELETE',
    headers: sessionHeaders(sessionToken),
  });
  if (!res.ok) throw new Error(`deactivate promo-code failed: ${res.status}`);
  return res.json();
}

/** Sealed archive objects metadata (JWT). */
export async function fetchArchiveSnapshots(serverId, sessionToken, query = {}) {
  const u = resolveUrl(`${BASE_URL}/servers/${encodeURIComponent(serverId)}/archive-snapshots`);
  if (query.pathId) u.searchParams.set('pathId', query.pathId);
  if (query.limit != null) u.searchParams.set('limit', String(query.limit));
  const res = await fetch(u, { headers: sessionHeaders(sessionToken) });
  if (!res.ok) throw new Error(`archive-snapshots failed: ${res.status}`);
  return res.json();
}
