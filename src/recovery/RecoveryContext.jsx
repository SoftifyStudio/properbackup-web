import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { startRecovery, confirmRecovery, cancelRecovery, fetchActiveRecoveries, createRecoveryStream } from '../api/bufferClient.js';

const RecoveryCtx = createContext(null);

export function useRecovery() {
  return useContext(RecoveryCtx);
}

function normalizeSession(raw) {
  if (!raw) return null;
  return {
    ...raw,
    sessionId: raw.sessionId || raw.session_id || raw.id,
    serverId: raw.serverId || raw.server_id,
  };
}

export function RecoveryProvider({ children }) {
  const { token } = useAuth();
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const sseRef = useRef(null);

  const connectStream = useCallback((sessionId) => {
    if (!token || !sessionId) return;
    sseRef.current?.close();
    const es = createRecoveryStream(sessionId, token);
    es.addEventListener('recovery_state', (e) => {
      try {
        const data = JSON.parse(e.data);
        setSession((prev) => prev ? normalizeSession({ ...prev, ...data }) : normalizeSession(data));
      } catch {}
    });
    es.addEventListener('recovery_progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        setSession((prev) => prev ? {
          ...prev,
          filesRestored: data.filesRestored ?? prev.filesRestored,
          filesDeleted: data.filesDeleted ?? prev.filesDeleted,
          bytesTransferred: data.bytesTransferred ?? prev.bytesTransferred,
        } : prev);
      } catch {}
    });
    es.addEventListener('error', () => {});
    sseRef.current = es;
  }, [token]);

  useEffect(() => {
    return () => sseRef.current?.close();
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchActiveRecoveries(null, token)
      .then((res) => {
        const sessions = res.sessions || (res.id ? [res] : []);
        if (sessions.length > 0) {
          const active = normalizeSession(sessions[0]);
          setSession(active);
          connectStream(active.sessionId);
        }
      })
      .catch(() => {});
  }, [token, connectStream]);

  const start = useCallback(async (serverId, snapshotId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await startRecovery(serverId, snapshotId, token);
      const normalized = normalizeSession(res);
      setSession(normalized);
      connectStream(normalized.sessionId);
      return normalized;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [token, connectStream]);

  const confirm = useCallback(async () => {
    if (!session?.sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await confirmRecovery(session.sessionId, token);
      setSession((prev) => normalizeSession({ ...prev, ...res }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, token]);

  const cancel = useCallback(async (reason) => {
    if (!session?.sessionId) return;
    setLoading(true);
    setError(null);
    try {
      await cancelRecovery(session.sessionId, reason, token);
      sseRef.current?.close();
      setSession(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, token]);

  const dismiss = useCallback(() => {
    sseRef.current?.close();
    setSession(null);
    setError(null);
  }, []);

  const value = {
    session,
    error,
    loading,
    start,
    confirm,
    cancel,
    dismiss,
    isActive: session != null && !['DONE', 'FAILED', 'CANCELLED'].includes(session.state),
  };

  return <RecoveryCtx.Provider value={value}>{children}</RecoveryCtx.Provider>;
}
