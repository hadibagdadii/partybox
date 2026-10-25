import { z } from 'zod';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './room-code.js';

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`),
    'Room code must be 4 letters',
  );

export const PLAYER_NAME_MAX = 12;

export const playerNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a name')
  .max(PLAYER_NAME_MAX, `Names are at most ${PLAYER_NAME_MAX} characters`);

const tokenSchema = z.string().uuid();

export const createRoomSchema = z.object({ gameId: z.string().min(1).max(40).optional() });
export type CreateRoomPayload = z.input<typeof createRoomSchema>;

export const setGameSchema = z.object({ gameId: z.string().min(1).max(40) });
export type SetGamePayload = z.input<typeof setGameSchema>;

export const joinRoomSchema = z.object({ code: roomCodeSchema, name: playerNameSchema });
export type JoinRoomPayload = z.input<typeof joinRoomSchema>;

export const resumePlayerSchema = z.object({ code: roomCodeSchema, playerToken: tokenSchema });
export type ResumePlayerPayload = z.input<typeof resumePlayerSchema>;

export const resumeHostSchema = z.object({ code: roomCodeSchema, hostToken: tokenSchema });
export type ResumeHostPayload = z.input<typeof resumeHostSchema>;

/** The game module validates `action` itself; the room only checks the envelope. */
export const gameActionSchema = z.object({ action: z.unknown() });
export type GameActionPayload = z.input<typeof gameActionSchema>;

export const emptySchema = z.object({}).strict();
export type EmptyPayload = z.input<typeof emptySchema>;

export const tutorialStepSchema = z.object({ dir: z.enum(['next', 'back']) }).strict();
export type TutorialStepPayload = z.input<typeof tutorialStepSchema>;

export const kickSchema = z.object({ playerId: z.string().min(1).max(64) }).strict();
export type KickPayload = z.input<typeof kickSchema>;

export type ErrorCode =
  | 'invalid_payload'
  | 'room_not_found'
  | 'not_in_room'
  | 'wrong_phase'
  | 'not_your_turn'
  | 'invalid_action'
  | 'invalid_token'
  | 'name_taken'
  | 'room_full'
  | 'game_in_progress'
  | 'not_vip'
  | 'not_enough_players'
  | 'unknown_game'
  | 'no_tutorial'
  | 'cannot_remove'
  | 'removed'
  | 'dev_only'
  | 'rate_limited'
  | 'too_many_rooms'
  | 'shutting_down';

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

/** Reply shape for every request/response socket event. */
export type AckResult<T extends object = object> =
  ({ ok: true } & T) | { ok: false; error: ErrorPayload };
export type Ack<T extends object = object> = (result: AckResult<T>) => void;

export type RoomPhase = 'lobby' | 'playing' | 'over';

export interface LobbyPlayer {
  id: string;
  name: string;
  isVip: boolean;
  isBot: boolean;
  connected: boolean;
  /** Disconnected long enough that the host may want to end the game. */
  awayLong: boolean;
}

/** Which tutorial slide the room is on; `slide` is 0-based. */
export interface TutorialView {
  slide: number;
  total: number;
}

/** Room info everyone may see. */
export interface LobbyView {
  code: string;
  gameId: string;
  gameName: string;
  minPlayers: number;
  maxPlayers: number;
  phase: RoomPhase;
  players: LobbyPlayer[];
  /** Set while the lobby is showing the game's tutorial. */
  tutorial: TutorialView | null;
}

export interface GameOption {
  id: string;
  name: string;
}

export interface HostViewMessage {
  room: LobbyView;
  /** Games this room can switch to while in the lobby. */
  games: GameOption[];
  /** Ids of players the game is waiting on; empty in the lobby. */
  waitingOn: string[];
  /** The game's host projection, or null in the lobby. */
  game: unknown;
}

export interface PlayerViewMessage {
  room: LobbyView;
  you: { id: string; name: string; isVip: boolean };
  canStart: boolean;
  /** The game's projection for this player, or null in the lobby. */
  game: unknown;
}

export interface ClientToServerEvents {
  ping: (ack: (reply: { ok: true; at: number }) => void) => void;
  'room:create': (
    payload: CreateRoomPayload,
    ack: Ack<{ code: string; hostToken: string }>,
  ) => void;
  'host:resume': (payload: ResumeHostPayload, ack: Ack) => void;
  'room:setGame': (payload: SetGamePayload, ack: Ack) => void;
  'room:join': (
    payload: JoinRoomPayload,
    ack: Ack<{ code: string; playerId: string; playerToken: string }>,
  ) => void;
  'player:resume': (payload: ResumePlayerPayload, ack: Ack<{ playerId: string }>) => void;
  'game:start': (payload: EmptyPayload, ack: Ack) => void;
  'game:action': (payload: GameActionPayload, ack: Ack) => void;
  'game:reset': (payload: EmptyPayload, ack: Ack) => void;
  /** VIP: a new game with the same players, seats reshuffled. */
  'game:playAgain': (payload: EmptyPayload, ack: Ack) => void;
  /** Host: ends the game for everyone, roles unrevealed, back to the lobby. */
  'game:end': (payload: EmptyPayload, ack: Ack) => void;
  'tutorial:start': (payload: EmptyPayload, ack: Ack) => void;
  'tutorial:step': (payload: TutorialStepPayload, ack: Ack) => void;
  /** Skips the rest of the tutorial and starts the game. */
  'tutorial:skip': (payload: EmptyPayload, ack: Ack) => void;
  /** Host removes a player from the lobby. */
  'room:kick': (payload: KickPayload, ack: Ack) => void;
  /** A player leaves the lobby. */
  'room:leave': (payload: EmptyPayload, ack: Ack) => void;
  'dev:addBot': (payload: EmptyPayload, ack: Ack<{ playerId: string }>) => void;
  /** Starts the game from the host screen, so an all-bot room can play. */
  'dev:start': (payload: EmptyPayload, ack: Ack) => void;
}

export interface ServerToClientEvents {
  error: (payload: ErrorPayload) => void;
  'host:view': (view: HostViewMessage) => void;
  'player:view': (view: PlayerViewMessage) => void;
  /** This phone's seat is gone: the host removed it, or the player left. */
  'player:removed': () => void;
  /** The server is restarting; this connection is about to close. */
  'server:shutdown': () => void;
}
