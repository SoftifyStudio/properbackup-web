import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { fetchActiveRecoveries, fetchRecoverySession, startRecovery, confirmRecovery, cancelRecovery } from '../api/recoveryClient.js';
import { bufferBaseUrl } from '../bufferConfig.js';

const RecoveryContext = createContext({
  activeRecoveries: new Map(),
  isRecoveryActive: () => false,
  recoveryForServer: () => null,
  startServerRecovery: async () => {},
  confirmServerRecovery: async () => {},
  cancelServerRecovery: async () => {},
  refreshSession: async () => {},
});

export function RecoveryProvider({ children }) {
  const { token } = useAuth();
  const [activeRecoveries, setActiveRecoveries] = useState(new Map());
  const sseRef = useRef(null);

  const loadActive = useCallback(async () => {
    if (!token) return;
    try {
      const sessions = await fetchActiveRecoveries(token);
      const map = new Map(sessions.map(s => [s.serverId, s]));
      setActiveRecoveries(map);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    loadActive();
    const iv = setInterval(loadActive, 30_000);
    return () => clearInterval(iv);
  }, [loadActive]);

  const refreshSession = useCallback(async (sessionId) => {
    if (!token || !sessionId) return null;
    try {
      const session = await fetchRecoverySession(sessionId, token);
      setActiveRecoveries(prev => {
        const next = new Map(prev);
        if (['DONE', 'FAILED', 'CANCELLED'].includes(session.state)) {
          next.delete(session.serverId);
        } else {
          next.set(session.serverId, session);
        }
        return next;
      });
      return session;
    } catch { return null; }
  }, [token]);

  const startServerRecovery = useCallback(async (serverId, snapshotId) => {
    if (!token) throw new Error('Not authenticated');
    const result = await startRecovery(serverId, snapshotId, token);
    if (result.session_id) {
      setTimeout(() => refreshSession(result.session_id), 500);
    }
    return result;
  }, [token, refreshSession]);

  const confirmServerRecovery = useCallback(async (sessionId) => {
    if (!token) throw new Error('Not authenticated');
    const result = await confirmRecovery(sessionId, token);
    setTimeout(() => refreshSession(sessionId), 500);
    return result;
  }, [token, refreshSession]);

  const cancelServerRecovery = useCallback(async (sessionId, reason) => {
    if (!token) throw new Error('Not authenticated');
    const result = await cancelRecovery(sessionId, reason, token);
    setTimeout(() => refreshSession(sessionId), 500);
    return result;
  }, [token, refreshSession]);

  const isRecoveryActive = useCallback((serverId) => activeRecoveries.has(serverId), [activeRecoveries]);
  const recoveryForServer = useCallback((serverId) => activeRecoveries.get(serverId) || null, [activeRecoveries]);

  return (
    <RecoveryContext.Provider value={{
      activeRecoveries,
      isRecoveryActive,
      recoveryForServer,
      startServerRecovery,
      confirmServerRecovery,
      cancelServerRecovery,
      refreshSession,
    }}>
      {children}
    </RecoveryContext.Provider>
  );
}

export const useRecoveryContext = () => useContext(RecoveryContext);
