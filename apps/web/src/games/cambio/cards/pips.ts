import type { Rank } from '@partybox/cambio';

/** Pip centers in the 250×350 card viewBox. Pips below the middle are drawn upside down. */
const L = 82;
const C = 125;
const R = 168;
const T = 80;
const B = 270;
const M = 175;
const Q1 = 143;
const Q3 = 207;

type Pt = readonly [number, number];
const corners: Pt[] = [
  [L, T],
  [R, T],
  [L, B],
  [R, B],
];

export const PIP_LAYOUTS: Partial<Record<Rank, readonly Pt[]>> = {
  '2': [
    [C, T],
    [C, B],
  ],
  '3': [
    [C, T],
    [C, M],
    [C, B],
  ],
  '4': corners,
  '5': [...corners, [C, M]],
  '6': [...corners, [L, M], [R, M]],
  '7': [...corners, [L, M], [R, M], [C, 127]],
  '8': [...corners, [L, M], [R, M], [C, 127], [C, 223]],
  '9': [...corners, [L, Q1], [R, Q1], [L, Q3], [R, Q3], [C, M]],
  '10': [...corners, [L, Q1], [R, Q1], [L, Q3], [R, Q3], [C, 111], [C, 239]],
};

export const PIP_SIZE = 44;
export const MIDLINE = M;
