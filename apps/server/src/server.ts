import type { IncomingMessage } from 'node:http';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import type { ServerConfig } from './config.js';
import { DEFAULT_GAME_ID, createGameRegistry } from './games.js';
import type { Logger } from './logger.js';
import { RoomService } from './rooms/room-service.js';
import { MemoryRoomStore, type RoomStore } from './rooms/room-store.js';
import { registerSocketHandlers, type IoServer } from './socket.js';

/** Largest socket message a client may send; real payloads are well under 1 KB. */
export const MAX_SOCKET_MESSAGE_BYTES = 16 * 1024;
/** How long clients get between the shutdown notice and their socket closing. */
export const SHUTDOWN_NOTICE_MS = 1500;

export interface PartyboxServer {
  httpServer: HttpServer;
  io: IoServer;
  rooms: RoomService;
  /** Resolves with the bound port (pass 0 for a random one). */
  listen(port: number): Promise<number>;
  /** Refuses new rooms, warns clients, waits `noticeMs`, then closes every socket. */
  shutdown(noticeMs?: number): Promise<void>;
}

/**
 * True when a browser handshake comes from this site or ALLOWED_ORIGIN. Websocket
 * upgrades skip CORS, so this is checked for every transport. Clients that send
 * no Origin (not a browser) are let through and still rate limited.
 */
export function originAllowed(req: IncomingMessage, allowedOrigin: string | undefined): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (allowedOrigin && origin === allowedOrigin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

/** The whole service: web app, /healthz, and Socket.IO on one HTTP server. */
export function createPartyboxServer(
  config: ServerConfig,
  logger: Logger,
  store: RoomStore = new MemoryRoomStore(),
): PartyboxServer {
  const app = createApp({
    webDist: config.webDist,
    trustProxyHops: config.trustProxyHops,
    allowedOrigin: config.allowedOrigin,
    logger,
  });
  const httpServer = createServer(app);
  const io: IoServer = new Server(httpServer, {
    maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,
    ...(config.allowedOrigin ? { cors: { origin: config.allowedOrigin } } : {}),
    // In dev the Vite proxy forwards a different Origin, so only production checks it.
    ...(config.isProd
      ? {
          allowRequest: (req, callback) => callback(null, originAllowed(req, config.allowedOrigin)),
        }
      : {}),
  });

  const rooms = new RoomService({
    store,
    games: createGameRegistry({ devTools: config.devTools }),
    defaultGameId: DEFAULT_GAME_ID,
    maxRooms: config.maxRooms,
    maxRoomsPerOwner: config.maxRoomsPerIp,
    logger,
  });
  const sockets = registerSocketHandlers(io, rooms, {
    devTools: config.devTools,
    bots: config.devTools ? config.bots : undefined,
    limits: config.limits,
    trustProxyHops: config.trustProxyHops,
    clientIpHeader: config.clientIpHeader,
    logger,
  });

  const sweeper = setInterval(() => {
    const removed = rooms.sweepIdle();
    for (const code of removed) sockets.cancelRoom(code);
    sockets.prune();
    if (removed.length) logger.info({ codes: removed }, 'rooms_expired');
  }, 60_000);
  sweeper.unref();

  let closing: Promise<void> | null = null;

  return {
    httpServer,
    io,
    rooms,
    listen: (port) =>
      new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, () => resolve((httpServer.address() as AddressInfo).port));
      }),
    shutdown: (noticeMs = SHUTDOWN_NOTICE_MS) => {
      closing ??= (async () => {
        clearInterval(sweeper);
        sockets.drain();
        if (noticeMs > 0) await new Promise((r) => setTimeout(r, noticeMs));
        sockets.close();
        // Disconnects every socket and closes the HTTP server.
        await io.close();
      })();
      return closing;
    },
  };
}
