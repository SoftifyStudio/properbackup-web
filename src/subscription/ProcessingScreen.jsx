import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { bufferBaseUrl } from '../bufferConfig.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const BASE_URL = bufferBaseUrl();
const SSE_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_RETRIES = 10;

/**
 * Post-checkout waiting screen.
 * Per master-tdd-plan.md §9.3 [TDD-F1]:
 * - Opens SSE EventSource to wait for subscription_activated event
 * - 30s timeout → "Operacja w toku. Odśwież za chwilę."
 * - SSE error → fallback to polling GET /account/subscription every 3s
 */
export default function ProcessingScreen({ onActivated }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [status, setStatus] = useState('waiting'); // waiting | timeout | activated | error
  const [plan, setPlan] = useState(null);
  const eventSourceRef = useRef(null);
  const timeoutRef = useRef(null);
  const pollRef = useRef(null);
  const pollCountRef = useRef(0);
  const activatedRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (activatedRef.current) return;

    // Start SSE connection
    const sseUrl = `${BASE_URL}/sse/subscription?token=${encodeURIComponent(token)}`;
    let es;
    try {
      es = new EventSource(sseUrl);
      eventSourceRef.current = es;
    } catch {
      startPolling();
      return;
    }

    es.addEventListener('subscription', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'subscription_activated') {
          activatedRef.current = true;
          setPlan(data.plan);
          setStatus('activated');
          cleanup();
          setTimeout(() => onActivated?.(data), 1500);
        }
      } catch { /* ignore parse errors */ }
    });

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      startPolling();
    };

    // 30s timeout
    timeoutRef.current = setTimeout(() => {
      if (!activatedRef.current) {
        setStatus('timeout');
        cleanup();
      }
    }, SSE_TIMEOUT_MS);

    return cleanup;
  }, [token]);

  function startPolling() {
    if (activatedRef.current) return;
    pollCountRef.current = 0;
    pollRef.current = setInterval(async () => {
      if (activatedRef.current) {
        clearInterval(pollRef.current);
        return;
      }
      pollCountRef.current++;
      if (pollCountRef.current > POLL_MAX_RETRIES) {
        setStatus('timeout');
        clearInterval(pollRef.current);
        return;
      }
      try {
        const res = await fetch(`${BASE_URL}/account/subscription`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const sub = await res.json();
          if (sub.plan && sub.plan !== 'trial' && sub.status === 'active') {
            activatedRef.current = true;
            setPlan(sub.plan);
            setStatus('activated');
            clearInterval(pollRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setTimeout(() => onActivated?.({ type: 'subscription_activated', plan: sub.plan }), 1500);
          }
        }
      } catch { /* ignore network errors during poll */ }
    }, POLL_INTERVAL_MS);
  }

  function cleanup() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-surface px-6"
      data-testid="processing-screen"
    >
      <div className="max-w-md w-full text-center space-y-6">
        {status === 'waiting' && (
          <>
            <div className="w-12 h-12 mx-auto border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <h2 className="text-xl font-bold text-text1">
              {t('processing.title')}
            </h2>
            <p className="text-sm text-text3">
              {t('processing.subtitle')}
            </p>
          </>
        )}

        {status === 'activated' && (
          <>
            <div className="w-12 h-12 mx-auto flex items-center justify-center bg-emerald-100 rounded-full">
              <svg className="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text1">
              {t('processing.activated')}
            </h2>
            <p className="text-sm text-text3">
              {plan?.toUpperCase()}
            </p>
          </>
        )}

        {status === 'timeout' && (
          <>
            <div className="w-12 h-12 mx-auto flex items-center justify-center bg-amber-100 rounded-full">
              <svg className="w-6 h-6 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text1">
              {t('processing.timeout')}
            </h2>
            <p className="text-sm text-text3">
              {t('processing.timeoutHint')}
            </p>
            <button
              className="mt-4 px-6 py-2.5 bg-accent hover:bg-accent/90 text-white text-sm font-semibold rounded-lg transition-colors"
              onClick={() => window.location.reload()}
            >
              {t('processing.refresh')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
