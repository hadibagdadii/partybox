import { cambioModule } from '@partybox/cambio';
import { cambioBot } from './cambio-bot.js';
import type { BotStrategy } from './strategy.js';

/** Bot strategies by game id. Games without one get random legal turn moves only. */
export const botStrategies: ReadonlyMap<string, BotStrategy> = new Map([
  [cambioModule.id, cambioBot],
]);

/** Turn-move filters for the room service, from the strategies that have one. */
export const botTurnFilters: ReadonlyMap<string, (action: unknown) => boolean> = new Map(
  [...botStrategies].flatMap(([id, s]) => (s.isTurnAction ? [[id, s.isTurnAction] as const] : [])),
);
