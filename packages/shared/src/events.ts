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
  | 'dev_only';

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
}

export interface HostViewMessage {
  room: LobbyView;
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
  'room:join': (
    payload: JoinRoomPayload,
    ack: Ack<{ code: string; playerId: string; playerToken: string }>,
  ) => void;
  'player:resume': (payload: ResumePlayerPayload, ack: Ack<{ playerId: string }>) => void;
  'game:start': (payload: EmptyPayload, ack: Ack) => void;
  'game:action': (payload: GameActionPayload, ack: Ack) => void;
  'game:reset': (payload: EmptyPayload, ack: Ack) => void;
  'dev:addBot': (payload: EmptyPayload, ack: Ack<{ playerId: string }>) => void;
}

export interface ServerToClientEvents {
  error: (payload: ErrorPayload) => void;
  'host:view': (view: HostViewMessage) => void;
  'player:view': (view: PlayerViewMessage) => void;
}
