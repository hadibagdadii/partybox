import type { AnyGameModule } from '@partybox/shared';
import { tapRaceModule } from '@partybox/tap-race';

/** Games a room can run. Diwan joins once its rules engine exists. */
export const gameRegistry: ReadonlyMap<string, AnyGameModule> = new Map<string, AnyGameModule>([
  [tapRaceModule.id, tapRaceModule as AnyGameModule],
]);

export const DEFAULT_GAME_ID = tapRaceModule.id;
