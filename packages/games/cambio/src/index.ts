import type { GameModule } from '@partybox/shared';
import { actionSchema, type CambioAction } from './actions.js';
import { MAX_PLAYERS, MIN_PLAYERS } from './cards.js';
import { legalActions, waitingOn } from './legal.js';
import { defaultOptions, optionsSchema, type CambioOptions } from './options.js';
import { reduce } from './reduce.js';
import { createInitialState } from './setup.js';
import type { CambioEvent, CambioState } from './state.js';
import { theme } from './theme.js';
import { getHostView, getPlayerView, type CambioHostView, type CambioPlayerView } from './views.js';

export * from './ids.js';
export * from './cards.js';
export { theme, type NameOf } from './theme.js';
export { actionSchema, type CambioAction, type CambioActionType } from './actions.js';
export {
  MATCH_TARGET_MAX,
  MATCH_TARGET_MIN,
  defaultOptions,
  optionsSchema,
  type CambioOptions,
} from './options.js';
export { legalActions, snapActions, turnActions, waitingOn } from './legal.js';
export { roundWinners, matchWinners, scoreHand } from './scoring.js';
export type * from './state.js';
export type { CambioHostView, CambioPlayerView } from './views.js';

export const cambioModule: GameModule<
  CambioState,
  CambioAction,
  CambioEvent,
  CambioHostView,
  CambioPlayerView,
  CambioOptions
> = {
  id: 'cambio',
  displayName: theme.title,
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  actionSchema,
  optionsSchema,
  defaultOptions,
  createInitialState,
  reduce,
  getHostView,
  getPlayerView,
  isOver: (state) => state.phase === 'over',
  waitingOn,
  legalActions,
  vipOnlyActions: ['continue'],
};
