import type { GameModule } from '@partybox/shared';
import { actionSchema, type DiwanAction } from './actions.js';
import { legalActions, waitingOn } from './legal.js';
import { reduce } from './reduce.js';
import { MAX_PLAYERS, MIN_PLAYERS } from './rules.js';
import { createInitialState } from './setup.js';
import { theme } from './theme.js';
import type { DiwanState, LogEntry } from './state.js';
import { getHostView, getPlayerView, type DiwanHostView, type DiwanPlayerView } from './views.js';

export * from './ids.js';
export { theme, type TutorialSlide } from './theme.js';
export { actionSchema, type DiwanAction } from './actions.js';
export { eligibleWazirIds, powerTargetIds } from './reduce.js';
export { legalActions, waitingOn } from './legal.js';
export {
  LOYAL_DECREES_TO_WIN,
  REBEL_DECREES_TO_WIN,
  UNREST_LIMIT,
  VETO_UNLOCK,
  powerTrack,
  teamOf,
} from './rules.js';
export type * from './state.js';
export type { DiwanHostView, DiwanPlayerView } from './views.js';

export type DiwanEvent = LogEntry;

export const diwanModule: GameModule<
  DiwanState,
  DiwanAction,
  DiwanEvent,
  DiwanHostView,
  DiwanPlayerView
> = {
  id: 'diwan',
  displayName: 'Diwan',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  tutorialSlides: theme.tutorial.slides.length,
  actionSchema,
  createInitialState,
  reduce,
  getHostView,
  getPlayerView,
  isOver: (state) => state.phase === 'over',
  waitingOn,
  legalActions,
  winnerTeam: (state) => state.winner?.team ?? null,
};
