/**
 * API helper for E2E tests — talks directly to the backend.
 */
const BASE = process.env.E2E_BASE_URL || 'http://properbackup-test-server.softify.com.pl';

export async function register(email, password) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Register failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getSubscription(token) {
  const res = await fetch(`${BASE}/api/account/subscription`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Subscription failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function createCheckout(token, plan, promoCode) {
  const body = { plan };
  if (promoCode) body.promoCode = promoCode;
  const res = await fetch(`${BASE}/api/payment/stripe/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Checkout failed: ${res.status} ${text}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return res.json();
}

export async function cancelSubscription(token) {
  const res = await fetch(`${BASE}/api/payment/stripe/cancel-subscription`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Cancel failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function renewSubscription(token) {
  const res = await fetch(`${BASE}/api/payment/stripe/renew`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Renew failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function reactivateSubscription(token) {
  const res = await fetch(`${BASE}/api/payment/stripe/reactivate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Reactivate failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function verifySession(token, sessionId) {
  const res = await fetch(`${BASE}/api/payment/stripe/verify-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
