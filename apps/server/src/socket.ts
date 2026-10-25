import {
  createRoomSchema,
  emptySchema,
  gameActionSchema,
  joinRoomSchema,
  resumeHostSchema,
  resumePlayerSchema,
  type Ack,
  type AckResult,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@partybox/shared';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import type { RoomService } from './rooms/room-service.js';

export interface SocketData {
  role?: 'host' | 'player';
  code?: string;
  playerId?: string;
}

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

export interface SocketOptions {
  /** Enables dev-only events such as adding bots. */
  devTools: boolean;
}

const hostChannel = (code: string) => `host:${code}`;
const playerChannel = (code: string, playerId: string) => `player:${code}:${playerId}`;

const invalidPayload = {
  ok: false,
  error: { code: 'invalid_payload', message: 'Invalid request' },
} as const;
const notInRoom = {
  ok: false,
  error: { code: 'not_in_room', message: 'Join a room first' },
} as const;

/** Clients can send anything; never trust that `ack` is callable. */
function replier<T extends object>(ack: unknown): Ack<T> {
  return typeof ack === 'function' ? (ack as Ack<T>) : () => undefined;
}

function parse<S extends z.ZodTypeAny>(schema: S, payload: unknown): z.output<S> | null {
  const result = schema.safeParse(payload);
  return result.success ? (result.data as z.output<S>) : null;
}

export function registerSocketHandlers(io: IoServer, rooms: RoomService, options: SocketOptions) {
  /** Hosts get the public projection; each phone gets only its own. */
  const broadcast = (code: string) => {
    const hostView = rooms.hostView(code);
    if (hostView) io.to(hostChannel(code)).emit('host:view', hostView);
    for (const playerId of rooms.humanPlayerIds(code)) {
      const view = rooms.playerView(code, playerId);
      if (view) io.to(playerChannel(code, playerId)).emit('player:view', view);
    }
  };

  /** Marks a seat disconnected once its last socket is gone. */
  const releaseSeat = (code: string, playerId: string) => {
    const remaining = io.sockets.adapter.rooms.get(playerChannel(code, playerId))?.size ?? 0;
    if (remaining === 0) {
      rooms.setConnected(code, playerId, false);
      broadcast(code);
    }
  };

  const unbind = (socket: IoSocket) => {
    const { role, code, playerId } = socket.data;
    if (role === 'host' && code) void socket.leave(hostChannel(code));
    if (role === 'player' && code && playerId) {
      void socket.leave(playerChannel(code, playerId));
      releaseSeat(code, playerId);
    }
    socket.data = {};
  };

  const bindHost = (socket: IoSocket, code: string) => {
    unbind(socket);
    void socket.join(hostChannel(code));
    socket.data = { role: 'host', code };
  };

  const bindPlayer = (socket: IoSocket, code: string, playerId: string) => {
    if (socket.data.code === code && socket.data.playerId === playerId) return;
    unbind(socket);
    void socket.join(playerChannel(code, playerId));
    socket.data = { role: 'player', code, playerId };
  };

  /** Runs a player-only command, then pushes fresh views on success. */
  const asPlayer = (
    socket: IoSocket,
    ack: unknown,
    run: (code: string, playerId: string) => AckResult,
  ) => {
    const reply = replier(ack);
    const { role, code, playerId } = socket.data;
    if (role !== 'player' || !code || !playerId) return reply(notInRoom);
    const result = run(code, playerId);
    reply(result);
    if (result.ok) broadcast(code);
  };

  io.on('connection', (socket) => {
    socket.on('ping', (ack) => {
      if (typeof ack === 'function') ack({ ok: true, at: Date.now() });
    });

    socket.on('room:create', (payload, ack) => {
      const reply = replier<{ code: string; hostToken: string }>(ack);
      const input = parse(createRoomSchema, payload);
      if (!input) return reply(invalidPayload);
      const result = rooms.createRoom(input.gameId);
      if (result.ok) bindHost(socket, result.code);
      reply(result);
      if (result.ok) broadcast(result.code);
    });

    socket.on('host:resume', (payload, ack) => {
      const reply = replier(ack);
      const input = parse(resumeHostSchema, payload);
      if (!input) return reply(invalidPayload);
      const result = rooms.resumeHost(input.code, input.hostToken);
      if (result.ok) bindHost(socket, input.code);
      reply(result);
      if (result.ok) broadcast(input.code);
    });

    socket.on('room:join', (payload, ack) => {
      const reply = replier<{ code: string; playerId: string; playerToken: string }>(ack);
      const input = parse(joinRoomSchema, payload);
      if (!input) return reply(invalidPayload);
      const result = rooms.join(input.code, input.name);
      if (!result.ok) return reply(result);
      bindPlayer(socket, input.code, result.playerId);
      reply({ ...result, code: input.code });
      broadcast(input.code);
    });

    socket.on('player:resume', (payload, ack) => {
      const reply = replier<{ playerId: string }>(ack);
      const input = parse(resumePlayerSchema, payload);
      if (!input) return reply(invalidPayload);
      const result = rooms.resumePlayer(input.code, input.playerToken);
      if (result.ok) bindPlayer(socket, input.code, result.playerId);
      reply(result);
      if (result.ok) broadcast(input.code);
    });

    socket.on('game:start', (payload, ack) => {
      if (!parse(emptySchema, payload)) return replier(ack)(invalidPayload);
      asPlayer(socket, ack, (code, playerId) => rooms.start(code, playerId));
    });

    socket.on('game:action', (payload, ack) => {
      const input = parse(gameActionSchema, payload);
      if (!input) return replier(ack)(invalidPayload);
      asPlayer(socket, ack, (code, playerId) => rooms.act(code, playerId, input.action));
    });

    socket.on('game:reset', (payload, ack) => {
      if (!parse(emptySchema, payload)) return replier(ack)(invalidPayload);
      asPlayer(socket, ack, (code, playerId) => rooms.reset(code, playerId));
    });

    socket.on('dev:addBot', (payload, ack) => {
      const reply = replier<{ playerId: string }>(ack);
      if (!options.devTools) {
        return reply({ ok: false, error: { code: 'dev_only', message: 'Bots are dev-only' } });
      }
      if (!parse(emptySchema, payload)) return reply(invalidPayload);
      const { role, code } = socket.data;
      if (role !== 'host' || !code) return reply(notInRoom);
      const result = rooms.addBot(code);
      reply(result);
      if (result.ok) broadcast(code);
    });

    socket.on('disconnect', () => {
      const { role, code, playerId } = socket.data;
      if (role === 'player' && code && playerId) releaseSeat(code, playerId);
    });
  });
}
