import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import * as api from '../api/recoveryClient.js';

const RecoverySessionContext = createContext(null);

const POLL_INTERVAL = 3000;

/**
 * Full-system recovery session state provider (HR-1).
 * Polls buffer for state changes and emits updates to subscribers.
 */
export function RecoverySessionProvider({ children }) {
  const { token } = useAuth();
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const startPolling = useCallback((sessionId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.getRecoverySession(sessionId, token);
        setSession(data);
        // Stop polling on terminal states
        if (['DONE', 'FAILED', 'CANCELLED'].includes(data.state)) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch (e) {
        console.error('[recovery] poll error:', e);
      }
    }, POLL_INTERVAL);
  }, [token]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const start = useCallback(async (serverId, snapshotId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.startRecovery(serverId, snapshotId, token);
      const sessionData = await api.getRecoverySession(result.session_id, token);
      setSession(sessionData);
      startPolling(result.session_id);
      return result;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [token, startPolling]);

  const confirm = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      await api.confirmRecovery(session.id, token);
      const updated = await api.getRecoverySession(session.id, token);
      setSession(updated);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [session, token]);

  const cancel = useCallback(async (reason = 'User cancelled') => {
    if (!session) return;
    setLoading(true);
    try {
      await api.cancelRecovery(session.id, token, reason);
      const updated = await api.getRecoverySession(session.id, token);
      setSession(updated);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [session, token]);

  const dismiss = useCallback(() => {
    setSession(null);
    setError(null);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const resume = useCallback(async (sessionId) => {
    try {
      const data = await api.getRecoverySession(sessionId, token);
      setSession(data);
      if (!['DONE', 'FAILED', 'CANCELLED'].includes(data.state)) {
        startPolling(sessionId);
      }
    } catch (e) {
      setError(e);
    }
  }, [token, startPolling]);

  const value = {
    session,
    error,
    loading,
    start,
    confirm,
    cancel,
    dismiss,
    resume,
    isActive: session && !['DONE', 'FAILED', 'CANCELLED'].includes(session.state),
  };

  return (
    <RecoverySessionContext.Provider value={value}>
      {children}
    </RecoverySessionContext.Provider>
  );
}

export function useRecoverySession() {
  const ctx = useContext(RecoverySessionContext);
  if (!ctx) throw new Error('useRecoverySession must be used inside RecoverySessionProvider');
  return ctx;
}
