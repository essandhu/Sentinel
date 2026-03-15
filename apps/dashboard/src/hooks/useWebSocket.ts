import { useAuth } from '@clerk/react';
import { useCallback, useEffect, useRef } from 'react';

export type WsEventHandler = (event: { type: string; payload: any }) => void;

export function useWebSocket(onEvent: WsEventHandler): void {
  const { getToken } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(async () => {
    if (unmountedRef.current) return;

    const token = await getToken();
    if (!token) return;
    if (unmountedRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retriesRef.current = 0;
    };

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(ev.data as string);
        onEventRef.current(parsed);
      } catch {
        // Silently ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      const delay = Math.min(1000 * 2 ** retriesRef.current, 30000);
      retriesRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connect();
      }, delay);
    };

    ws.onerror = () => {
      // No-op: onclose handles reconnection
    };
  }, [getToken]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect from cleanup close
        wsRef.current.close();
      }
    };
  }, [connect]);
}
