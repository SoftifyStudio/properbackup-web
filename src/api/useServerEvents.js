/**
 * React hook: connects to the Buffer SSE stream for a given server.
 * Emits real-time events (agentStatus, fileState, fileStateBatch, log)
 * so the panel no longer needs to poll.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { bufferBaseUrl } from '../bufferConfig.js';

const BASE_URL = bufferBaseUrl();

/**
 * @param {string} serverId
 * @param {object} handlers  – { onAgentStatus, onFileState, onFileStateBatch, onLog, onSnapshotCreated, onRecoveryState, onRecoveryProgress }
 * @param {string} [token]   – JWT token for authenticated SSE
 * @returns {{ connected: boolean, reconnecting: boolean }}
 */
export default function useServerEvents(serverId, handlers, token) {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!serverId) return;

    let es;
    let closed = false;
    let retryTimer;

    function connect() {
      if (closed) return;
      let url = `${BASE_URL}/servers/${encodeURIComponent(serverId)}/events`;
      if (token) url += `?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);

      es.addEventListener('connected', () => {
        setConnected(true);
        setReconnecting(false);
      });

      es.addEventListener('agentStatus', (e) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current.onAgentStatus?.(data);
        } catch { /* ignore */ }
      });

      es.addEventListener('fileState', (e) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current.onFileState?.(data);
        } catch { /* ignore */ }
      });

      es.addEventListener('fileStateBatch', (e) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current.onFileStateBatch?.(data);
        } catch { /* ignore */ }
      });

      es.addEventListener('log', (e) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current.onLog?.(data);
        } catch { /* ignore */ }
      });

      es.addEventListener('snapshotCreated', (e) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current.onSnapshotCreated?.(data);
        } catch { /* ignore */ }
      });

      es.addEventListener('recovery_state', (e) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current.onRecoveryState?.(data);
        } catch { /* ignore */ }
      });

      es.addEventListener('recovery_progress', (e) => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current.onRecoveryProgress?.(data);
        } catch { /* ignore */ }
      });

      es.onerror = () => {
        setConnected(false);
        setReconnecting(true);
        es.close();
        if (!closed) {
          retryTimer = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(retryTimer);
      if (es) es.close();
      setConnected(false);
      setReconnecting(false);
    };
  }, [serverId, token]);

  return { connected, reconnecting };
}
