import type { GameModule } from '@partybox/shared';

export * from './ids.js';
export { theme } from './theme.js';

// Placeholder types until the rules engine lands.
export interface DiwanState {
  playerIds: string[];
}
export type DiwanAction = never;
export type DiwanEvent = never;
export interface DiwanHostView {
  playerCount: number;
}
export interface DiwanPlayerView extends DiwanHostView {
  playerId: string;
}

export const diwanModule: GameModule<
  DiwanState,
  DiwanAction,
  DiwanEvent,
  DiwanHostView,
  DiwanPlayerView
> = {
  id: 'diwan',
  minPlayers: 5,
  maxPlayers: 10,
  setup: (playerIds) => ({ playerIds: [...playerIds] }),
  reduce: (state) => ({ state, events: [] }),
  getHostView: (state) => ({ playerCount: state.playerIds.length }),
  getPlayerView: (state, playerId) => ({ playerCount: state.playerIds.length, playerId }),
};
