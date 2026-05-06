import { STORAGE_KEY } from './storage.js';

/** Dekoduje base64url → UTF-8 string. */
function b64UrlToUtf8(b64url) {
  let s = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Jednorazowe zalogowanie z agenta: URL kończy się na #pb_session=<base64url JSON>.
 * Fragment nie trafia do serwera HTTP.
 */
export function consumeAgentSessionHash() {
  const h = window.location.hash;
  if (!h.startsWith('#pb_session=')) return;
  const enc = h.slice('#pb_session='.length).trim();
  if (!enc) return;
  try {
    const json = JSON.parse(b64UrlToUtf8(enc));
    if (!json?.token) return;
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: json.token,
        email: json.email ?? '',
        id: json.id ?? '',
        isSystemAdmin: !!json.isSystemAdmin,
      }),
    );
    const path = window.location.pathname + window.location.search;
    window.history.replaceState({}, document.title, path);
  } catch {
    /* ignore */
  }
}
