import type { DecreeId, PowerId, RoleId, TeamId } from './ids.js';

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;

/** Loyal / rebel split by player count. The rebel count includes the Usurper. */
export const ROLE_SPLIT: Readonly<Record<number, { loyal: number; rebel: number }>> = {
  5: { loyal: 3, rebel: 2 },
  6: { loyal: 4, rebel: 2 },
  7: { loyal: 4, rebel: 3 },
  8: { loyal: 5, rebel: 3 },
  9: { loyal: 5, rebel: 4 },
  10: { loyal: 6, rebel: 4 },
};

export const DECK_COMPOSITION: Readonly<Record<DecreeId, number>> = { loyal: 6, rebel: 11 };
export const DECK_SIZE = DECK_COMPOSITION.loyal + DECK_COMPOSITION.rebel;

export const LOYAL_DECREES_TO_WIN = 5;
export const REBEL_DECREES_TO_WIN = 6;
export const UNREST_LIMIT = 3;
export const VETO_UNLOCK = 5;
/** Rebel decrees needed before electing the Usurper as Wazir wins the game. */
export const USURPER_ELECTION_THRESHOLD = 3;
/** At or below this many living players, the last Ameer may be nominated Wazir again. */
export const SMALL_TABLE_ALIVE = 5;
export const LEGISLATIVE_DRAW = 3;

/** Executive power at each rebel track slot (index 0 = slot 1), or null for none. */
export type PowerTrack = readonly (PowerId | null)[];

export function powerTrack(playerCount: number): PowerTrack {
  if (playerCount <= 6) return [null, null, 'policyPeek', 'execution', 'execution'];
  if (playerCount <= 8) return [null, 'investigate', 'specialElection', 'execution', 'execution'];
  return ['investigate', 'investigate', 'specialElection', 'execution', 'execution'];
}

export function teamOf(role: RoleId): TeamId {
  return role === 'loyal' ? 'loyal' : 'rebel';
}

/** In small games the Usurper knows the rebels; in 7+ they play blind. */
export function usurperSeesRebels(playerCount: number): boolean {
  return playerCount <= 6;
}
