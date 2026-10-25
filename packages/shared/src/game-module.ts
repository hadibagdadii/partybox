import type { Rng } from './rng.js';

export interface ReduceResult<State, Event> {
  state: State;
  events: Event[];
}

/**
 * Contract every game implements so it plugs into the shared room system.
 * Engines are pure: no I/O, no clock, randomness only through `rng`.
 */
export interface GameModule<State, Action, Event, HostView, PlayerView> {
  id: string;
  minPlayers: number;
  maxPlayers: number;
  setup(playerIds: readonly string[], rng: Rng): State;
  reduce(state: State, action: Action, rng: Rng): ReduceResult<State, Event>;
  /** Public information only: never roles, deck order, or hands. */
  getHostView(state: State): HostView;
  /** Host view plus only what this player is allowed to know. */
  getPlayerView(state: State, playerId: string): PlayerView;
}
