import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { DEFAULT_GAME_ID, gameRegistry } from './games.js';
import { RoomService } from './rooms/room-service.js';
import { MemoryRoomStore } from './rooms/room-store.js';
import { registerSocketHandlers, type IoServer } from './socket.js';

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3000);
const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = process.env.WEB_DIST ?? path.resolve(here, '../../web/dist');

// In dev, Vite serves the web app and proxies /healthz and /socket.io here.
const app = createApp({ webDist: isProd ? webDist : undefined });
const httpServer = createServer(app);
const io: IoServer = new Server(httpServer);

const rooms = new RoomService({
  store: new MemoryRoomStore(),
  games: gameRegistry,
  defaultGameId: DEFAULT_GAME_ID,
});
registerSocketHandlers(io, rooms, { devTools: !isProd });

setInterval(() => {
  const removed = rooms.sweepIdle();
  if (removed.length) console.log(`expired idle rooms: ${removed.join(', ')}`);
}, 60_000).unref();

httpServer.listen(port, () => {
  console.log(
    `partybox server listening on http://localhost:${port} (${isProd ? 'production' : 'development'})`,
  );
});
