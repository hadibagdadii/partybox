import type {
  ClientToServerEvents,
  HostViewMessage,
  PlayerViewMessage,
  ServerToClientEvents,
} from '@partybox/shared';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { DEFAULT_GAME_ID, createGameRegistry } from './games.js';
import { RoomService } from './rooms/room-service.js';
import { MemoryRoomStore } from './rooms/room-store.js';
import { registerSocketHandlers, type IoServer, type SocketOptions } from './socket.js';

export type Client = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

export interface TestServer {
  url: string;
  client(): Promise<Client>;
  close(): Promise<void>;
}

/** A real Socket.IO server on a random port, with dev tools on. */
export async function startTestServer(
  options: SocketOptions = { devTools: true },
): Promise<TestServer> {
  const httpServer = createServer();
  const io: IoServer = new Server(httpServer);
  const rooms = new RoomService({
    store: new MemoryRoomStore(),
    games: createGameRegistry({ devTools: options.devTools }),
    defaultGameId: DEFAULT_GAME_ID,
  });
  const handle = registerSocketHandlers(io, rooms, options);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
  const clients: Client[] = [];

  return {
    url,
    async client() {
      const socket: Client = connect(url, { transports: ['websocket'], forceNew: true });
      clients.push(socket);
      await new Promise<void>((resolve) => socket.on('connect', resolve));
      return socket;
    },
    async close() {
      handle.close();
      for (const c of clients.splice(0)) c.disconnect();
      await io.close();
    },
  };
}

/** Records every message of each kind a socket receives. */
export function record(socket: Client) {
  const host: HostViewMessage[] = [];
  const player: PlayerViewMessage[] = [];
  socket.on('host:view', (v) => host.push(v));
  socket.on('player:view', (v) => player.push(v));
  return { host, player };
}

export async function until(check: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 10));
  }
}

export async function ok<T>(promise: Promise<T>): Promise<Extract<T, { ok: true }>> {
  const result = await promise;
  if (!(result as { ok: boolean }).ok) throw new Error(JSON.stringify(result));
  return result as Extract<T, { ok: true }>;
}
