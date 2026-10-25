import type { ClientToServerEvents, ServerToClientEvents } from '@partybox/shared';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { createApp } from './app.js';

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3000);
const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = process.env.WEB_DIST ?? path.resolve(here, '../../web/dist');

// In dev, Vite serves the web app and proxies /healthz and /socket.io here.
const app = createApp({ webDist: isProd ? webDist : undefined });
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);

io.on('connection', (socket) => {
  socket.on('ping', (ack) => {
    if (typeof ack === 'function') ack({ ok: true, at: Date.now() });
  });
});

httpServer.listen(port, () => {
  console.log(
    `partybox server listening on http://localhost:${port} (${isProd ? 'production' : 'development'})`,
  );
});
