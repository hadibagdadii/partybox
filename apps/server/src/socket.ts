import {
  createRng,
  createRoomSchema,
  emptySchema,
  gameActionSchema,
  joinRoomSchema,
  kickSchema,
  resumeHostSchema,
  resumePlayerSchema,
  setGameSchema,
  tutorialStepSchema,
  type Ack,
  type AckResult,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@partybox/shared';
import { randomInt } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import { BotRunner } from './rooms/bot-runner.js';
import { AWAY_LONG_MS, type RoomService } from './rooms/room-service.js';

export interface SocketData {
  role?: 'host' | 'player';
  code?: string;
  playerId?: string;
}

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

export interface SocketOptions {
  /** Enables dev-only events such as adding bots, and runs the bots. */
  devTools: boolean;
  /** Bot timing and seed; tests set the delays to 0. */
  bots?: { minDelayMs?: number; maxDelayMs?: number; seed?: number };
}

export interface SocketHandle {
  /** Clears pending bot timers for a room that is going away. */
  cancelRoom(code: string): void;
  /** Clears every pending bot timer. */
  close(): void;
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

export function registerSocketHandlers(
  io: IoServer,
  rooms: RoomService,
  options: SocketOptions,
): SocketHandle {
  const bots = options.devTools
    ? new BotRunner({
        rooms,
        rng: createRng(options.bots?.seed ?? randomInt(2 ** 31)),
        minDelayMs: options.bots?.minDelayMs,
        maxDelayMs: options.bots?.maxDelayMs,
        onChange: (code) => broadcast(code),
      })
    : null;

  /** Hosts get the public projection; each phone gets only its own. Then bots get their turn. */
  const broadcast = (code: string) => {
    const hostView = rooms.hostView(code);
    if (hostView) io.to(hostChannel(code)).emit('host:view', hostView);
    for (const playerId of rooms.humanPlayerIds(code)) {
      const view = rooms.playerView(code, playerId);
      if (view) io.to(playerChannel(code, playerId)).emit('player:view', view);
    }
    bots?.sync(code);
  };

  /** One timer per away seat, so the TV hears when a player has been gone too long. */
  const awayTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const clearAway = (code: string, playerId: string) => {
    const key = playerChannel(code, playerId);
    clearTimeout(awayTimers.get(key));
    awayTimers.delete(key);
  };

  /** Marks a seat disconnected once its last socket is gone. */
  const releaseSeat = (code: string, playerId: string) => {
    const channel = playerChannel(code, playerId);
    const remaining = io.sockets.adapter.rooms.get(channel)?.size ?? 0;
    if (remaining === 0) {
      rooms.setConnected(code, playerId, false);
      broadcast(code);
      clearAway(code, playerId);
      const timer = setTimeout(() => {
        awayTimers.delete(channel);
        broadcast(code);
      }, AWAY_LONG_MS + 50);
      timer.unref?.();
      awayTimers.set(channel, timer);
    }
  };

  /** Tells a removed seat's phones, then unsubscribes them so they get no more views. */
  const evict = (code: string, playerId: string) => {
    const channel = playerChannel(code, playerId);
    clearAway(code, playerId);
    io.to(channel).emit('player:removed');
    for (const id of io.sockets.adapter.rooms.get(channel) ?? []) {
      const s = io.sockets.sockets.get(id);
      if (!s) continue;
      void s.leave(channel);
      s.data = {};
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

  /** Runs a host-only command, then pushes fresh views on success. */
  const asHost = (socket: IoSocket, ack: unknown, run: (code: string) => AckResult) => {
    const reply = replier(ack);
    const { role, code } = socket.data;
    if (role !== 'host' || !code) return reply(notInRoom);
    const result = run(code);
    reply(result);
    if (result.ok) broadcast(code);
  };

  const devOnly = {
    ok: false,
    error: { code: 'dev_only', message: 'That is a dev-only tool' },
  } as const;

  const bindHost = (socket: IoSocket, code: string) => {
    unbind(socket);
    void socket.join(hostChannel(code));
    socket.data = { role: 'host', code };
  };

  const bindPlayer = (socket: IoSocket, code: string, playerId: string) => {
    clearAway(code, playerId);
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

    socket.on('room:setGame', (payload, ack) => {
      const input = parse(setGameSchema, payload);
      if (!input) return replier(ack)(invalidPayload);
      asHost(socket, ack, (code) => rooms.setGame(code, input.gameId));
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

    socket.on('game:playAgain', (payload, ack) => {
      if (!parse(emptySchema, payload)) return replier(ack)(invalidPayload);
      asPlayer(socket, ack, (code, playerId) => {
        bots?.cancel(code);
        return rooms.playAgain(code, playerId);
      });
    });

    socket.on('game:end', (payload, ack) => {
      if (!parse(emptySchema, payload)) return replier(ack)(invalidPayload);
      asHost(socket, ack, (code) => {
        bots?.cancel(code);
        return rooms.endGame(code);
      });
    });

    socket.on('tutorial:start', (payload, ack) => {
      if (!parse(emptySchema, payload)) return replier(ack)(invalidPayload);
      asPlayer(socket, ack, (code, playerId) => rooms.startTutorial(code, playerId));
    });

    socket.on('tutorial:step', (payload, ack) => {
      const input = parse(tutorialStepSchema, payload);
      if (!input) return replier(ack)(invalidPayload);
      asPlayer(socket, ack, (code, playerId) => rooms.stepTutorial(code, playerId, input.dir));
    });

    socket.on('tutorial:skip', (payload, ack) => {
      if (!parse(emptySchema, payload)) return replier(ack)(invalidPayload);
      asPlayer(socket, ack, (code, playerId) => rooms.skipTutorial(code, playerId));
    });

    socket.on('room:kick', (payload, ack) => {
      const input = parse(kickSchema, payload);
      if (!input) return replier(ack)(invalidPayload);
      asHost(socket, ack, (code) => {
        const result = rooms.kick(code, input.playerId);
        if (result.ok) evict(code, input.playerId);
        return result;
      });
    });

    socket.on('room:leave', (payload, ack) => {
      if (!parse(emptySchema, payload)) return replier(ack)(invalidPayload);
      asPlayer(socket, ack, (code, playerId) => {
        const result = rooms.leave(code, playerId);
        if (result.ok) evict(code, playerId);
        return result;
      });
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

    socket.on('dev:start', (payload, ack) => {
      if (!options.devTools) return replier(ack)(devOnly);
      if (!parse(emptySchema, payload)) return replier(ack)(invalidPayload);
      asHost(socket, ack, (code) => rooms.devStart(code));
    });

    socket.on('disconnect', () => {
      const { role, code, playerId } = socket.data;
      if (role === 'player' && code && playerId) releaseSeat(code, playerId);
    });
  });

  return {
    cancelRoom: (code) => {
      bots?.cancel(code);
      for (const [key, timer] of awayTimers) {
        if (key.startsWith(`player:${code}:`)) {
          clearTimeout(timer);
          awayTimers.delete(key);
        }
      }
    },
    close: () => {
      bots?.cancelAll();
      for (const timer of awayTimers.values()) clearTimeout(timer);
      awayTimers.clear();
    },
  };
}
