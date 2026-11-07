import type { PowerId, Rank, Suit } from './ids.js';
import { SUITED_RANKS, SUITS } from './ids.js';

/** What is printed on a card. Jokers have no suit. */
export interface Face {
  rank: Rank;
  suit: Suit | null;
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
/** Largest table that plays with a single deck. */
export const ONE_DECK_MAX_PLAYERS = 8;
export const CARDS_PER_DECK = 54;
export const HAND_SIZE = 4;
/** Slots of the 2x2 grid each player peeks at before the first turn: the bottom row. */
export const PEEK_POSITIONS = [2, 3] as const;

export const decksFor = (playerCount: number): number =>
  playerCount > ONE_DECK_MAX_PLAYERS ? 2 : 1;

export const isRed = (face: Face): boolean => face.suit === 'hearts' || face.suit === 'diamonds';

export function cardValue(face: Face): number {
  switch (face.rank) {
    case 'joker':
      return 0;
    case 'A':
      return 1;
    case 'J':
    case 'Q':
      return 10;
    case 'K':
      return isRed(face) ? -1 : 10;
    default:
      return Number(face.rank);
  }
}

/** Ranks match by rank only: red and black Kings are both K, Jokers match Jokers. */
export const sameRank = (a: Face, b: Face): boolean => a.rank === b.rank;

/** The power a card has when discarded straight after being drawn. */
export function powerOf(face: Face): PowerId | null {
  switch (face.rank) {
    case '7':
    case '8':
      return 'peekOwn';
    case '9':
    case '10':
      return 'peekOther';
    case 'J':
      return 'swapOthers';
    case 'Q':
      return 'swapAny';
    case 'K':
      return isRed(face) ? null : 'peekSwap';
    default:
      return null;
  }
}

/** `decks` full decks of 52 cards plus 2 Jokers each, in a fixed order. */
export function buildFaces(decks: number): Face[] {
  const faces: Face[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) for (const rank of SUITED_RANKS) faces.push({ rank, suit });
    faces.push({ rank: 'joker', suit: null }, { rank: 'joker', suit: null });
  }
  return faces;
}
