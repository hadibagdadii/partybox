/** Neutral engine ids. Player-facing names live in theme.ts. */
export const RANKS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'joker',
] as const;
export type Rank = (typeof RANKS)[number];

/** Ranks that come in all four suits; Jokers have no suit. */
export const SUITED_RANKS = RANKS.filter((r): r is Exclude<Rank, 'joker'> => r !== 'joker');

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

export const POWER_IDS = ['peekOwn', 'peekOther', 'swapOthers', 'swapAny', 'peekSwap'] as const;
export type PowerId = (typeof POWER_IDS)[number];

export const PHASES = ['peek', 'play', 'roundOver', 'over'] as const;
export type Phase = (typeof PHASES)[number];

/**
 * Steps of one turn: `start` (draw or call), `drawn` (holding the drawn card), `power` (choosing a
 * target), `looking` (seeing a peeked card), `kingDecide` (black King: swap or keep).
 */
export const STAGES = ['start', 'drawn', 'power', 'looking', 'kingDecide'] as const;
export type Stage = (typeof STAGES)[number];

export const SCORING_MODES = ['single', 'match'] as const;
export type ScoringMode = (typeof SCORING_MODES)[number];
