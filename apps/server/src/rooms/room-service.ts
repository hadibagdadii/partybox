import {
  createRng,
  generateRoomCode,
  type AckResult,
  type AnyGameModule,
  type ErrorCode,
  type HostViewMessage,
  type PlayerViewMessage,
} from '@partybox/shared';
import { randomInt, randomUUID } from 'node:crypto';
import type { Room, Seat } from './room.js';
import type { RoomStore } from './room-store.js';
import { buildHostView, buildPlayerView } from './views.js';

export interface RoomServiceOptions {
  store: RoomStore;
  games: ReadonlyMap<string, AnyGameModule>;
  defaultGameId: string;
  /** Integer in [0, n). Used for room codes and game seeds. */
  randInt?: (maxExclusive: number) => number;
  newId?: () => string;
}

function fail(
  code: ErrorCode,
  message: string,
): { ok: false; error: { code: ErrorCode; message: string } } {
  return { ok: false, error: { code, message } };
}

const roomNotFound = () => fail('room_not_found', 'No room with that code');
const notInRoom = () => fail('not_in_room', 'You are not in this room');

/**
 * All room rules, with no knowledge of sockets. The socket layer calls these and
 * then pushes `hostView` / `playerView` projections to the right clients.
 */
export class RoomService {
  private readonly store: RoomStore;
  private readonly games: ReadonlyMap<string, AnyGameModule>;
  private readonly defaultGameId: string;
  private readonly randInt: (maxExclusive: number) => number;
  private readonly newId: () => string;

  constructor(options: RoomServiceOptions) {
    this.store = options.store;
    this.games = options.games;
    this.defaultGameId = options.defaultGameId;
    this.randInt = options.randInt ?? ((n) => randomInt(n));
    this.newId = options.newId ?? randomUUID;
  }

  createRoom(gameId = this.defaultGameId): AckResult<{ code: string; hostToken: string }> {
    if (!this.games.has(gameId)) return fail('unknown_game', `No game called ${gameId}`);
    const code = generateRoomCode(this.randInt, (c) => this.store.has(c));
    const room: Room = {
      code,
      hostToken: this.newId(),
      gameId,
      phase: 'lobby',
      seats: [],
      vipId: null,
      game: null,
    };
    this.store.save(room);
    return { ok: true, code, hostToken: room.hostToken };
  }

  resumeHost(code: string, hostToken: string): AckResult {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    if (room.hostToken !== hostToken) return fail('invalid_token', 'That host session has expired');
    this.store.save(room);
    return { ok: true };
  }

  /** `name` must already be trimmed and length-checked by the payload schema. */
  join(code: string, name: string): AckResult<{ playerId: string; playerToken: string }> {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    const game = this.gameFor(room);
    if (room.phase !== 'lobby') return fail('game_in_progress', 'That game has already started');
    if (room.seats.length >= game.maxPlayers) return fail('room_full', 'That room is full');
    if (this.nameTaken(room, name)) return fail('name_taken', 'Someone already has that name');

    const seat = this.addSeat(room, name, false);
    return { ok: true, playerId: seat.id, playerToken: seat.token };
  }

  /** Reclaims a seat after a refresh, lock, or dropped connection. */
  resumePlayer(code: string, playerToken: string): AckResult<{ playerId: string }> {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    const seat = room.seats.find((s) => !s.isBot && s.token === playerToken);
    if (!seat) return fail('invalid_token', 'That seat is no longer yours');
    seat.connected = true;
    this.store.save(room);
    return { ok: true, playerId: seat.id };
  }

  setConnected(code: string, playerId: string, connected: boolean): void {
    const room = this.store.get(code);
    const seat = room?.seats.find((s) => s.id === playerId);
    if (!room || !seat || seat.isBot) return;
    seat.connected = connected;
    this.store.save(room);
  }

  addBot(code: string): AckResult<{ playerId: string }> {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    const game = this.gameFor(room);
    if (room.phase !== 'lobby') return fail('game_in_progress', 'That game has already started');
    if (room.seats.length >= game.maxPlayers) return fail('room_full', 'That room is full');
    let n = 1;
    while (this.nameTaken(room, `Bot ${n}`)) n++;
    const seat = this.addSeat(room, `Bot ${n}`, true);
    return { ok: true, playerId: seat.id };
  }

  start(code: string, playerId: string): AckResult {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    if (!room.seats.some((s) => s.id === playerId)) return notInRoom();
    const game = this.gameFor(room);
    if (room.vipId !== playerId) return fail('not_vip', 'Only the VIP can start the game');
    if (room.phase !== 'lobby') return fail('wrong_phase', 'The game has already started');
    if (room.seats.length < game.minPlayers) {
      return fail('not_enough_players', `Need at least ${game.minPlayers} players`);
    }
    const rng = createRng(this.randInt(2 ** 31));
    const seats = room.seats.map((s) => ({ id: s.id, name: s.name }));
    room.game = { state: game.createInitialState(seats, rng), rng };
    room.phase = 'playing';
    this.store.save(room);
    return { ok: true };
  }

  act(code: string, playerId: string, rawAction: unknown): AckResult {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    if (!room.seats.some((s) => s.id === playerId)) return notInRoom();
    if (room.phase !== 'playing' || !room.game) {
      return fail('wrong_phase', 'There is no game in progress');
    }
    const game = this.gameFor(room);
    const parsed = game.actionSchema.safeParse(rawAction);
    if (!parsed.success) return fail('invalid_action', 'That action is not valid');

    const result = game.reduce(room.game.state, { playerId, action: parsed.data }, room.game.rng);
    if (!result.ok) return { ok: false, error: result.error };
    room.game.state = result.state;
    if (game.isOver(result.state)) room.phase = 'over';
    this.store.save(room);
    return { ok: true };
  }

  /** VIP sends everyone back to the lobby after a game ends. */
  reset(code: string, playerId: string): AckResult {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    if (!room.seats.some((s) => s.id === playerId)) return notInRoom();
    if (room.vipId !== playerId) return fail('not_vip', 'Only the VIP can do that');
    if (room.phase !== 'over') return fail('wrong_phase', 'The game is not over yet');
    room.phase = 'lobby';
    room.game = null;
    this.store.save(room);
    return { ok: true };
  }

  sweepIdle(): string[] {
    return this.store.sweepIdle();
  }

  hostView(code: string): HostViewMessage | null {
    const room = this.store.get(code);
    return room ? buildHostView(room, this.gameFor(room)) : null;
  }

  playerView(code: string, playerId: string): PlayerViewMessage | null {
    const room = this.store.get(code);
    return room ? buildPlayerView(room, this.gameFor(room), playerId) : null;
  }

  /** Human seats that may have a phone listening. Bots have no client. */
  humanPlayerIds(code: string): string[] {
    return (
      this.store
        .get(code)
        ?.seats.filter((s) => !s.isBot)
        .map((s) => s.id) ?? []
    );
  }

  private addSeat(room: Room, name: string, isBot: boolean): Seat {
    const seat: Seat = { id: this.newId(), name, token: this.newId(), isBot, connected: true };
    room.seats.push(seat);
    if (!isBot && room.vipId === null) room.vipId = seat.id;
    this.store.save(room);
    return seat;
  }

  private nameTaken(room: Room, name: string): boolean {
    const key = name.trim().toLocaleLowerCase();
    return room.seats.some((s) => s.name.toLocaleLowerCase() === key);
  }

  private gameFor(room: Room): AnyGameModule {
    const game = this.games.get(room.gameId);
    if (!game) throw new Error(`Room ${room.code} has unknown game ${room.gameId}`);
    return game;
  }
}
