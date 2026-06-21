import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { fetchActiveRecoveries, startRecovery as apiStart, cancelRecovery as apiCancel, confirmRecovery as apiConfirm } from '../api/recoveryClient.js';

const RecoveryContext = createContext({
  activeRecoveries: new Map(),
  startRecovery: () => {},
  cancelRecovery: () => {},
  confirmRecovery: () => {},
  isRecoveryActive: () => false,
  recoveryForServer: () => null,
  refreshRecoveries: () => {},
});

export function RecoveryProvider({ children }) {
  const { token } = useAuth();
  const [activeRecoveries, setActiveRecoveries] = useState(new Map());
  const mountedRef = useRef(true);

  const refreshRecoveries = useCallback(async () => {
    if (!token) return;
    try {
      const sessions = await fetchActiveRecoveries(token);
      if (!mountedRef.current) return;
      const map = new Map(sessions.map(s => [s.serverId, s]));
      setActiveRecoveries(map);
    } catch {
      // keep existing state on error
    }
  }, [token]);

  // Poll active recoveries every 15s
  useEffect(() => {
    refreshRecoveries();
    const interval = setInterval(refreshRecoveries, 15_000);
    return () => clearInterval(interval);
  }, [refreshRecoveries]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const updateSession = useCallback((session) => {
    setActiveRecoveries(prev => {
      const next = new Map(prev);
      if (['DONE', 'FAILED', 'CANCELLED'].includes(session.state)) {
        next.delete(session.serverId);
      } else {
        next.set(session.serverId, session);
      }
      return next;
    });
  }, []);

  const startRecovery = useCallback(async (serverId, targetSnapshotId, selectedPaths = null) => {
    if (!token) throw new Error('Not authenticated');
    const result = await apiStart(token, serverId, targetSnapshotId, selectedPaths);
    await refreshRecoveries();
    return result;
  }, [token, refreshRecoveries]);

  const confirmRecovery = useCallback(async (sessionId, coldTier = false) => {
    if (!token) throw new Error('Not authenticated');
    const result = await apiConfirm(token, sessionId, coldTier);
    await refreshRecoveries();
    return result;
  }, [token, refreshRecoveries]);

  const cancelRecovery = useCallback(async (sessionId, reason = '') => {
    if (!token) throw new Error('Not authenticated');
    const result = await apiCancel(token, sessionId, reason);
    await refreshRecoveries();
    return result;
  }, [token, refreshRecoveries]);

  const isRecoveryActive = useCallback((serverId) => activeRecoveries.has(serverId), [activeRecoveries]);
  const recoveryForServer = useCallback((serverId) => activeRecoveries.get(serverId) || null, [activeRecoveries]);

  return (
    <RecoveryContext.Provider value={{
      activeRecoveries,
      startRecovery,
      cancelRecovery,
      confirmRecovery,
      isRecoveryActive,
      recoveryForServer,
      refreshRecoveries,
      updateSession,
    }}>
      {children}
    </RecoveryContext.Provider>
  );
}

export function useRecoveryContext() {
  return useContext(RecoveryContext);
}
