import type { ClientToServerEvents, ServerToClientEvents } from '@partybox/shared';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/** One shared connection per tab. Socket.IO reconnects on its own after drops. */
export function getSocket(): AppSocket {
  socket ??= io();
  return socket;
}

export function useConnected(s: AppSocket): boolean {
  const [connected, setConnected] = useState(s.connected);
  useEffect(() => {
    const up = () => setConnected(true);
    const down = () => setConnected(false);
    s.on('connect', up);
    s.on('disconnect', down);
    setConnected(s.connected);
    return () => {
      s.off('connect', up);
      s.off('disconnect', down);
    };
  }, [s]);
  return connected;
}

/**
 * Runs `onConnect` now if connected and again after every reconnect, and wakes
 * the socket when a locked phone comes back to the foreground.
 */
export function useOnConnect(s: AppSocket, onConnect: (() => void) | null): void {
  useEffect(() => {
    if (!onConnect) return;
    if (s.connected) onConnect();
    s.on('connect', onConnect);
    const wake = () => {
      if (document.visibilityState === 'visible' && !s.connected) s.connect();
    };
    document.addEventListener('visibilitychange', wake);
    return () => {
      s.off('connect', onConnect);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [s, onConnect]);
}
