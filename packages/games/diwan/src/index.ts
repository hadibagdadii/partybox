import type { GameModule } from '@partybox/shared';
import { z } from 'zod';

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
  displayName: 'Diwan',
  minPlayers: 5,
  maxPlayers: 10,
  actionSchema: z.never(),
  createInitialState: (players) => ({ playerIds: players.map((p) => p.id) }),
  reduce: (state) => ({ ok: true, state, events: [] }),
  getHostView: (state) => ({ playerCount: state.playerIds.length }),
  getPlayerView: (state, playerId) => ({ playerCount: state.playerIds.length, playerId }),
  isOver: () => false,
};
