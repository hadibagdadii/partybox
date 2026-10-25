import type {
  ClientToServerEvents,
  HostViewMessage,
  PlayerViewMessage,
  ServerToClientEvents,
} from '@partybox/shared';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GAME_ID, gameRegistry } from './games.js';
import { RoomService } from './rooms/room-service.js';
import { MemoryRoomStore } from './rooms/room-store.js';
import { registerSocketHandlers, type IoServer } from './socket.js';

type Client = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

let httpServer: HttpServer;
let io: IoServer;
let url: string;
const clients: Client[] = [];

beforeEach(async () => {
  httpServer = createServer();
  io = new Server(httpServer);
  const rooms = new RoomService({
    store: new MemoryRoomStore(),
    games: gameRegistry,
    defaultGameId: DEFAULT_GAME_ID,
  });
  registerSocketHandlers(io, rooms, { devTools: true });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await io.close();
});

async function client(): Promise<Client> {
  const socket: Client = connect(url, { transports: ['websocket'], forceNew: true });
  clients.push(socket);
  await new Promise<void>((resolve) => socket.on('connect', resolve));
  return socket;
}

/** Records every message of each kind a socket receives. */
function record(socket: Client) {
  const host: HostViewMessage[] = [];
  const player: PlayerViewMessage[] = [];
  socket.on('host:view', (v) => host.push(v));
  socket.on('player:view', (v) => player.push(v));
  return { host, player };
}

async function until(check: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function ok<T>(promise: Promise<T>): Promise<Extract<T, { ok: true }>> {
  const result = await promise;
  if (!(result as { ok: boolean }).ok) throw new Error(JSON.stringify(result));
  return result as Extract<T, { ok: true }>;
}

describe('socket room flow', () => {
  it('sends hosts only host views and players only their own view', async () => {
    const tv = await client();
    const tvLog = record(tv);
    const { code } = await ok(tv.emitWithAck('room:create', {}));

    const amina = await client();
    const aminaLog = record(amina);
    const bilal = await client();
    const bilalLog = record(bilal);
    const a = await ok(
      amina.emitWithAck('room:join', { code: code.toLowerCase(), name: ' Amina ' }),
    );
    const b = await ok(bilal.emitWithAck('room:join', { code, name: 'Bilal' }));
    await ok(tv.emitWithAck('dev:addBot', {}));

    await ok(amina.emitWithAck('game:start', {}));
    await ok(bilal.emitWithAck('game:action', { action: { type: 'tap' } }));
    await until(() => tvLog.host.some((v) => v.room.phase === 'over'));
    await until(() => aminaLog.player.some((v) => v.room.phase === 'over'));

    // Host never receives a player projection, and nothing player-only.
    expect(tvLog.player).toHaveLength(0);
    for (const view of tvLog.host) {
      expect(view).not.toHaveProperty('you');
      expect(view).not.toHaveProperty('canStart');
      if (view.game) expect(view.game).not.toHaveProperty('youWon');
    }
    expect(JSON.stringify(tvLog.host)).not.toContain(a.playerToken);

    // Players never receive host views or another player's projection.
    expect(aminaLog.host).toHaveLength(0);
    expect(aminaLog.player.every((v) => v.you.id === a.playerId)).toBe(true);
    expect(bilalLog.player.every((v) => v.you.id === b.playerId)).toBe(true);
    expect(aminaLog.player.at(-1)?.game).toMatchObject({ youWon: false });
    expect(bilalLog.player.at(-1)?.game).toMatchObject({ youWon: true });
  });

  it('gives a reconnecting phone its seat back and flags it while away', async () => {
    const tv = await client();
    const tvLog = record(tv);
    const { code, hostToken } = await ok(tv.emitWithAck('room:create', {}));

    const phone = await client();
    const joined = await ok(phone.emitWithAck('room:join', { code, name: 'Amina' }));
    phone.disconnect();
    await until(() => tvLog.host.at(-1)?.room.players[0]?.connected === false);

    const again = await client();
    const againLog = record(again);
    const resumed = await ok(
      again.emitWithAck('player:resume', { code, playerToken: joined.playerToken }),
    );
    expect(resumed.playerId).toBe(joined.playerId);
    await until(() => tvLog.host.at(-1)?.room.players[0]?.connected === true);
    await until(() => againLog.player.length > 0);
    expect(againLog.player.at(-1)?.you).toMatchObject({ id: joined.playerId, isVip: true });
    expect(tvLog.host.at(-1)?.room.players).toHaveLength(1);

    // A refreshed TV gets the current host view back.
    const tv2 = await client();
    const tv2Log = record(tv2);
    await ok(tv2.emitWithAck('host:resume', { code, hostToken }));
    await until(() => tv2Log.host.length > 0);
    expect(tv2Log.host.at(-1)?.room.players[0]?.name).toBe('Amina');
  });

  it('rejects bad payloads and wrong-role commands with typed errors', async () => {
    const socket = await client();
    // @ts-expect-error deliberately malformed
    const bad = await socket.emitWithAck('room:join', { code: 'BCDF' });
    expect(bad).toMatchObject({ ok: false, error: { code: 'invalid_payload' } });
    const start = await socket.emitWithAck('game:start', {});
    expect(start).toMatchObject({ ok: false, error: { code: 'not_in_room' } });
    const bot = await socket.emitWithAck('dev:addBot', {});
    expect(bot).toMatchObject({ ok: false, error: { code: 'not_in_room' } });
  });
});
