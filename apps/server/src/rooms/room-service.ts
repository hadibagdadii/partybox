import {
  createRng,
  generateRoomCode,
  type AckResult,
  type AnyGameModule,
  type ErrorCode,
  type GameOption,
  type HostViewMessage,
  type PlayerViewMessage,
} from '@partybox/shared';
import { randomInt, randomUUID } from 'node:crypto';
import type { Room, Seat } from './room.js';
export { AWAY_LONG_MS } from './room.js';
import { silentLogger, type Logger } from '../logger.js';
import type { RoomStore } from './room-store.js';
import { buildHostView, buildPlayerView } from './views.js';

/** A bot seat the game is waiting on, with every action it may take. */
export interface BotTurn {
  botId: string;
  actions: unknown[];
}

export interface RoomServiceOptions {
  store: RoomStore;
  games: ReadonlyMap<string, AnyGameModule>;
  defaultGameId: string;
  /** Integer in [0, n). Used for room codes and game seeds. */
  randInt?: (maxExclusive: number) => number;
  newId?: () => string;
  /** Clock for the away flag. */
  now?: () => number;
  /** Rooms allowed at once, across everyone. */
  maxRooms?: number;
  /** Rooms one owner (client IP hash) may hold open at once. */
  maxRoomsPerOwner?: number;
  logger?: Logger;
}

export const DEFAULT_MAX_ROOMS = 200;
export const DEFAULT_MAX_ROOMS_PER_OWNER = 3;

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
  private readonly now: () => number;
  private readonly maxRooms: number;
  private readonly maxRoomsPerOwner: number;
  private readonly logger: Logger;

  constructor(options: RoomServiceOptions) {
    this.store = options.store;
    this.games = options.games;
    this.defaultGameId = options.defaultGameId;
    this.randInt = options.randInt ?? ((n) => randomInt(n));
    this.newId = options.newId ?? randomUUID;
    this.now = options.now ?? Date.now;
    this.maxRooms = options.maxRooms ?? DEFAULT_MAX_ROOMS;
    this.maxRoomsPerOwner = options.maxRoomsPerOwner ?? DEFAULT_MAX_ROOMS_PER_OWNER;
    this.logger = options.logger ?? silentLogger;
  }

  /** `ownerKey` identifies the creator (an IP hash) for the per-owner cap. */
  createRoom(
    gameId = this.defaultGameId,
    ownerKey: string | null = null,
  ): AckResult<{ code: string; hostToken: string }> {
    if (!this.games.has(gameId)) return fail('unknown_game', `No game called ${gameId}`);
    let total = 0;
    let owned = 0;
    for (const room of this.store.all()) {
      total++;
      if (ownerKey !== null && room.ownerKey === ownerKey) owned++;
    }
    if (total >= this.maxRooms) {
      this.logger.warn({ ipHash: ownerKey, cap: 'total' }, 'room_cap_hit');
      return fail('too_many_rooms', 'The server is full right now. Try again later.');
    }
    if (owned >= this.maxRoomsPerOwner) {
      this.logger.warn({ ipHash: ownerKey, cap: 'per_ip' }, 'room_cap_hit');
      return fail('too_many_rooms', 'Too many rooms are open from your network already.');
    }
    const code = generateRoomCode(this.randInt, (c) => this.store.has(c));
    const room: Room = {
      code,
      hostToken: this.newId(),
      gameId,
      phase: 'lobby',
      seats: [],
      vipId: null,
      game: null,
      rng: createRng(this.randInt(2 ** 31)),
      tutorial: null,
      removedTokens: new Set(),
      ownerKey,
    };
    this.store.save(room);
    this.logger.info({ code, gameId, ipHash: ownerKey }, 'room_created');
    return { ok: true, code, hostToken: room.hostToken };
  }

  /** Switches the room's game while everyone is still in the lobby. */
  setGame(code: string, gameId: string): AckResult {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    const game = this.games.get(gameId);
    if (!game) return fail('unknown_game', `No game called ${gameId}`);
    if (room.phase !== 'lobby') return fail('game_in_progress', 'That game has already started');
    if (room.seats.length > game.maxPlayers) {
      return fail('room_full', `${game.displayName} allows at most ${game.maxPlayers} players`);
    }
    room.gameId = gameId;
    this.store.save(room);
    return { ok: true };
  }

  availableGames(): GameOption[] {
    return [...this.games.values()].map((g) => ({ id: g.id, name: g.displayName }));
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
    if (!seat) {
      return room.removedTokens.has(playerToken)
        ? fail('removed', 'You were removed from the room')
        : fail('invalid_token', 'That seat is no longer yours');
    }
    seat.connected = true;
    seat.disconnectedAt = null;
    this.store.save(room);
    return { ok: true, playerId: seat.id };
  }

  setConnected(code: string, playerId: string, connected: boolean): void {
    const room = this.store.get(code);
    const seat = room?.seats.find((s) => s.id === playerId);
    if (!room || !seat || seat.isBot) return;
    seat.connected = connected;
    seat.disconnectedAt = connected ? null : (seat.disconnectedAt ?? this.now());
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
    if (room.vipId !== playerId) return fail('not_vip', 'Only the VIP can start the game');
    return this.startRoom(room);
  }

  /** Dev-only: the host starts the game, so a room of bots with no VIP can play. */
  devStart(code: string): AckResult {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    return this.startRoom(room);
  }

  private startRoom(room: Room): AckResult {
    const game = this.gameFor(room);
    if (room.phase !== 'lobby') return fail('wrong_phase', 'The game has already started');
    if (room.seats.length < game.minPlayers) {
      return fail('not_enough_players', `Need at least ${game.minPlayers} players`);
    }
    const rng = createRng(room.rng.int(2 ** 31));
    const seats = room.seats.map((s) => ({ id: s.id, name: s.name }));
    room.game = { state: game.createInitialState(seats, rng), rng };
    room.phase = 'playing';
    room.tutorial = null;
    this.store.save(room);
    this.logger.info(
      { code: room.code, gameId: room.gameId, players: seats.length },
      'game_started',
    );
    return { ok: true };
  }

  /** VIP opens the game's tutorial on the TV instead of starting straight away. */
  startTutorial(code: string, playerId: string): AckResult {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    const denied = this.vipInLobby(room, playerId);
    if (denied) return denied;
    if (!this.gameFor(room).tutorialSlides) return fail('no_tutorial', 'This game has no tutorial');
    room.tutorial = 0;
    this.store.save(room);
    return { ok: true };
  }

  /** Moves one slide; Next on the last slide starts the game. Back on the first stays put. */
  stepTutorial(code: string, playerId: string, dir: 'next' | 'back'): AckResult {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    const denied = this.vipInLobby(room, playerId);
    if (denied) return denied;
    if (room.tutorial === null) return fail('wrong_phase', 'The tutorial is not running');
    const total = this.gameFor(room).tutorialSlides ?? 0;
    if (dir === 'next' && room.tutorial >= total - 1) return this.startRoom(room);
    room.tutorial = dir === 'next' ? room.tutorial + 1 : Math.max(0, room.tutorial - 1);
    this.store.save(room);
    return { ok: true };
  }

  /** Ends the tutorial and starts the game. */
  skipTutorial(code: string, playerId: string): AckResult {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    const denied = this.vipInLobby(room, playerId);
    if (denied) return denied;
    if (room.tutorial === null) return fail('wrong_phase', 'The tutorial is not running');
    return this.startRoom(room);
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
    if (game.isOver(result.state)) {
      room.phase = 'over';
      const winner = game.winnerTeam?.(result.state) ?? null;
      this.logger.info({ code, gameId: room.gameId, winner }, 'game_ended');
    }
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

  /** VIP starts a fresh game with the same players, in a new seat order from the room's RNG. */
  playAgain(code: string, playerId: string): AckResult {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    if (!room.seats.some((s) => s.id === playerId)) return notInRoom();
    if (room.vipId !== playerId) return fail('not_vip', 'Only the VIP can do that');
    if (room.phase !== 'over') return fail('wrong_phase', 'The game is not over yet');
    const seats = room.seats;
    for (let i = seats.length - 1; i > 0; i--) {
      const j = room.rng.int(i + 1);
      [seats[i], seats[j]] = [seats[j]!, seats[i]!];
    }
    room.phase = 'lobby';
    room.game = null;
    return this.startRoom(room);
  }

  /** Host ends the game for everyone. Roles are dropped with the state, never revealed. */
  endGame(code: string): AckResult {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    if (room.phase === 'lobby') return fail('wrong_phase', 'There is no game in progress');
    if (room.phase === 'playing') {
      this.logger.info({ code, gameId: room.gameId, winner: null, endedBy: 'host' }, 'game_ended');
    }
    room.phase = 'lobby';
    room.game = null;
    room.tutorial = null;
    this.store.save(room);
    return { ok: true };
  }

  /** Host removes a seat. Only in the lobby: mid-game it would break the roles. */
  kick(code: string, playerId: string): AckResult<{ playerId: string }> {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    if (!room.seats.some((s) => s.id === playerId)) return notInRoom();
    if (room.phase !== 'lobby') {
      return fail('cannot_remove', 'Players can only be removed in the lobby');
    }
    this.removeSeat(room, playerId);
    return { ok: true, playerId };
  }

  /** A player leaves the lobby. */
  leave(code: string, playerId: string): AckResult {
    const room = this.store.get(code);
    if (!room) return roomNotFound();
    if (!room.seats.some((s) => s.id === playerId)) return notInRoom();
    if (room.phase !== 'lobby') return fail('game_in_progress', 'You can leave once the game ends');
    this.removeSeat(room, playerId);
    return { ok: true };
  }

  /** Bots the game is waiting on. Humans are never acted for, connected or not. */
  botTurns(code: string): BotTurn[] {
    const room = this.store.get(code);
    if (!room || room.phase !== 'playing' || !room.game) return [];
    const game = this.gameFor(room);
    if (!game.waitingOn || !game.legalActions) return [];
    const { state } = room.game;
    const waiting = new Set(game.waitingOn(state));
    return room.seats
      .filter((s) => s.isBot && waiting.has(s.id))
      .map((s) => ({ botId: s.id, actions: game.legalActions?.(state, s.id) ?? [] }))
      .filter((turn) => turn.actions.length > 0);
  }

  sweepIdle(): string[] {
    return this.store.sweepIdle();
  }

  hostView(code: string): HostViewMessage | null {
    const room = this.store.get(code);
    return room ? buildHostView(room, this.gameFor(room), this.availableGames(), this.now()) : null;
  }

  playerView(code: string, playerId: string): PlayerViewMessage | null {
    const room = this.store.get(code);
    return room ? buildPlayerView(room, this.gameFor(room), playerId, this.now()) : null;
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

  /** Null if `playerId` is the VIP and the room is in the lobby; the error otherwise. */
  private vipInLobby(room: Room, playerId: string): AckResult | null {
    if (!room.seats.some((s) => s.id === playerId)) return notInRoom();
    if (room.vipId !== playerId) return fail('not_vip', 'Only the VIP can do that');
    if (room.phase !== 'lobby') return fail('wrong_phase', 'The game has already started');
    return null;
  }

  /** Drops a seat, remembers its token, and passes VIP to the next human in join order. */
  private removeSeat(room: Room, playerId: string): void {
    const seat = room.seats.find((s) => s.id === playerId);
    if (!seat) return;
    room.seats = room.seats.filter((s) => s.id !== playerId);
    if (!seat.isBot) room.removedTokens.add(seat.token);
    if (room.vipId === playerId) room.vipId = room.seats.find((s) => !s.isBot)?.id ?? null;
    this.store.save(room);
  }

  private addSeat(room: Room, name: string, isBot: boolean): Seat {
    const seat: Seat = {
      id: this.newId(),
      name,
      token: this.newId(),
      isBot,
      connected: true,
      disconnectedAt: null,
    };
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
