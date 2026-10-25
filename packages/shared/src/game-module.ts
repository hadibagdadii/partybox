import type { z } from 'zod';
import type { Rng } from './rng.js';

/** A seated player as the room hands it to a game. */
export interface SeatInfo {
  id: string;
  name: string;
}

export interface GameError {
  code: 'wrong_phase' | 'not_your_turn' | 'invalid_action';
  message: string;
}

export type ReduceResult<State, Event> =
  { ok: true; state: State; events: Event[] } | { ok: false; error: GameError };

/** An action plus the seat that sent it. The room fills in `playerId`, never the client. */
export interface PlayerAction<Action> {
  playerId: string;
  action: Action;
}

/**
 * Contract every game implements so it plugs into the shared room system.
 * Engines are pure: no I/O, no clock, randomness only through `rng`.
 */
export interface GameModule<State, Action, Event, HostView, PlayerView> {
  id: string;
  /** Neutral fallback name; games with a theme show their themed title in their own screens. */
  displayName: string;
  minPlayers: number;
  maxPlayers: number;
  /** Validates untrusted action payloads before they reach `reduce`. */
  actionSchema: z.ZodType<Action, z.ZodTypeDef, unknown>;
  createInitialState(players: readonly SeatInfo[], rng: Rng): State;
  /** Rejects wrong-phase or wrong-player actions with a typed error, never by throwing. */
  reduce(state: State, action: PlayerAction<Action>, rng: Rng): ReduceResult<State, Event>;
  /** Public information only: never roles, deck order, or hands. */
  getHostView(state: State): HostView;
  /** Host view plus only what this player is allowed to know. */
  getPlayerView(state: State, playerId: string): PlayerView;
  isOver(state: State): boolean;
  /** Ids of players the game cannot advance without. The host screen lists them. */
  waitingOn?(state: State): string[];
  /** Every action `playerId` may send right now. Dev bots pick from these. */
  legalActions?(state: State, playerId: string): Action[];
}

/** A game module with its types erased, as the room system holds it. */
export type AnyGameModule = GameModule<unknown, unknown, unknown, unknown, unknown>;
