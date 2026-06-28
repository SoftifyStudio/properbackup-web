/**
 * React hook: subscribes to recovery session state via SSE + polling.
 * Listens for recovery_state and recovery_progress events from the
 * server's SSE stream, with polling fallback every 5s.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchRecoverySession } from '../api/recoveryClient.js';

/**
 * @param {string|null} sessionId - recovery session ID to track
 * @param {string|null} token - JWT auth token
 * @param {object} sseData - { recoveryState, recoveryProgress } from parent SSE
 * @returns {{ session: object|null, loading: boolean, error: string|null, refresh: () => void }}
 */
export default function useRecoverySession(sessionId, token, sseData) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!sessionId || !token) return;
    setLoading(true);
    try {
      const data = await fetchRecoverySession(token, sessionId);
      if (mountedRef.current) {
        setSession(data);
        setError(null);
      }
    } catch (e) {
      if (mountedRef.current) setError(e.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [sessionId, token]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling fallback every 5s
  useEffect(() => {
    if (!sessionId || !token) return;
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [sessionId, token, refresh]);

  // Update from SSE data
  useEffect(() => {
    if (!sseData) return;
    if (sseData.sessionId === sessionId) {
      setSession(prev => prev ? { ...prev, ...sseData } : prev);
    }
  }, [sseData, sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  return { session, loading, error, refresh };
}
