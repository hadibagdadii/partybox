import type {
  ClientToServerEvents,
  HostViewMessage,
  PlayerViewMessage,
  ServerToClientEvents,
} from '@partybox/shared';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { DEFAULT_LIMITS, type ServerConfig } from './config.js';
import { silentLogger, type Logger } from './logger.js';
import { createPartyboxServer, type PartyboxServer } from './server.js';

export type Client = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

export interface TestServer {
  url: string;
  server: PartyboxServer;
  client(): Promise<Client>;
  close(): Promise<void>;
}

export type TestServerOptions = Partial<ServerConfig> & { logger?: Logger };

/** Dev settings unless overridden; no web app served. */
export function testConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    isProd: false,
    port: 0,
    devTools: true,
    bots: undefined,
    allowedOrigin: undefined,
    maxRooms: 200,
    maxRoomsPerIp: 3,
    trustProxyHops: 0,
    limits: DEFAULT_LIMITS,
    webDist: undefined,
    ...overrides,
  };
}

/** A real Partybox server on a random port, with dev tools on unless told otherwise. */
export async function startTestServer({
  logger = silentLogger,
  ...overrides
}: TestServerOptions = {}): Promise<TestServer> {
  const server = createPartyboxServer(testConfig(overrides), logger);
  const port = await server.listen(0);
  const url = `http://localhost:${port}`;
  const clients: Client[] = [];

  return {
    url,
    server,
    async client() {
      const socket: Client = connect(url, { transports: ['websocket'], forceNew: true });
      clients.push(socket);
      await new Promise<void>((resolve) => socket.on('connect', resolve));
      return socket;
    },
    async close() {
      for (const c of clients.splice(0)) c.disconnect();
      await server.shutdown(0);
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
