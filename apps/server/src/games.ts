import { cambioModule } from '@partybox/cambio';
import { diwanModule } from '@partybox/diwan';
import type { AnyGameModule } from '@partybox/shared';
import { tapRaceModule } from '@partybox/tap-race';

export interface GameRegistryOptions {
  /** Tap Race only proves the room plumbing, so it is offered with dev tools only. */
  devTools: boolean;
  /** Cambio is offered once ENABLE_CAMBIO turns it on (always in dev). */
  enableCambio?: boolean;
}

/** Games a room can run, in the order the host's game picker lists them. */
export function createGameRegistry({
  devTools,
  enableCambio = devTools,
}: GameRegistryOptions): ReadonlyMap<string, AnyGameModule> {
  const games = new Map<string, AnyGameModule>([[diwanModule.id, diwanModule as AnyGameModule]]);
  if (enableCambio) games.set(cambioModule.id, cambioModule as unknown as AnyGameModule);
  if (devTools) games.set(tapRaceModule.id, tapRaceModule as AnyGameModule);
  return games;
}

export const DEFAULT_GAME_ID = diwanModule.id;
