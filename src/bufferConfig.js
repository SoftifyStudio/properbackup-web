/**
 * Buffer HTTP base URL (browser-visible).
 * - If VITE_BUFFER_URL is set → use it (np. `/api` za nginx, lub pełny URL do buffera).
 * - W dev (Vite) bez nadpisania → same-origin `/api` (proxy w vite.config).
 * - Build produkcyjny bez zmiennej → `/api` (zakładamy reverse proxy obok statycznych plików).
 */
export function bufferBaseUrl() {
  const v = import.meta.env.VITE_BUFFER_URL;
  if (v != null && String(v).trim() !== '') {
    return String(v).trim().replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    return '/api';
  }
  return '/api';
}

export function bufferUploadToken() {
  return import.meta.env.VITE_BUFFER_TOKEN || 'dev-token-local';
}
