/**
 * Cambio design tokens: a modern card table, separate from Diwan's court theme.
 * Colors, type, card geometry, shadows, and the motion system's timing all live here.
 */
export const colors = {
  /** Felt, center to edge. */
  felt: '#11553f',
  feltDeep: '#0b3428',
  feltEdge: '#072219',
  /** Text and chrome on the felt. */
  chalk: '#e9efe9',
  chalkDim: '#b4c8bd',
  rail: '#2a1d14',
  /** Card stock. */
  stock: '#f6f3ea',
  stockShade: '#e9e3d4',
  ink: '#16191c',
  red: '#c3263b',
  /** Card back. */
  backField: '#1a2747',
  backFieldDeep: '#121c35',
  brass: '#c7a047',
  brassLight: '#e3c77c',
  /** Value badges: red Kings (-1) and Jokers (0). */
  badgeMinus: '#c3263b',
  badgeZero: '#1d6b52',
  /** Highlight ring for reduced motion and focus moments. */
  glow: '#f2d27a',
  danger: '#c4423a',
} as const;

export const fonts = {
  /** One family with a width axis: expanded heavy for indices, condensed for labels. */
  card: ['Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
} as const;

/** Card faces are drawn in a 250×350 viewBox (5:7); every size is a width in px. */
export const CARD_VIEW = { w: 250, h: 350 } as const;
export const CARD_RATIO = CARD_VIEW.h / CARD_VIEW.w;
/** Corner radius in viewBox units (7% of width); the back's inner frame is concentric. */
export const CARD_RADIUS = 17.5;
export const BACK_INSET = 11;

/** Nominal widths in px. The table layout scales `table` and `pile` to the screen. */
export const cardSizes = {
  hand: 96,
  table: 72,
  pile: 150,
} as const;
export type CardSize = keyof typeof cardSizes;

/** Layered, transparent shadows: resting and lifted. Drawn on a separate layer, never animated. */
export const shadows = {
  rest: '0 1px 1px rgba(0,0,0,.28), 0 3px 6px rgba(0,0,0,.22), 0 10px 18px -8px rgba(0,0,0,.35)',
  lift: '0 2px 3px rgba(0,0,0,.22), 0 14px 22px -6px rgba(0,0,0,.42), 0 30px 40px -18px rgba(0,0,0,.5)',
} as const;

/** Easing curves (web-animation-design): ease-in-out for on-screen moves, ease-out for arrivals. */
export const ease = {
  inOutCubic: [0.645, 0.045, 0.355, 1] as const,
  outQuint: [0.23, 1, 0.32, 1] as const,
  outCubic: [0.215, 0.61, 0.355, 1] as const,
};

/** Springs as duration plus bounce; bounce stays subtle. */
export const springs = {
  slide: { type: 'spring', duration: 0.38, bounce: 0.1 },
  settle: { type: 'spring', duration: 0.25, bounce: 0 },
} as const;

/** Base durations in ms, matched to distance. Exits run about 20% faster than entrances. */
export const timing = {
  flip: 260,
  draw: 360,
  slide: 380,
  exitArc: 320,
  arc: 440,
  peek: 300,
  /** A peek holds, lifted toward the peeker, for about a second so everyone sees it. */
  peekHold: 1000,
  snapFlight: 340,
  shake: 320,
  give: 340,
  penalty: 380,
  sweep: 480,
  call: 420,
  dealFlight: 340,
  dealStaggerMax: 60,
  dealSpread: 1400,
  revealFlip: 260,
  revealStagger: 140,
  highlight: 600,
  /** The screen may lag the real state by at most this much backlog. */
  lagBudget: 1000,
  /** A sped-up step never goes below this, or below half its length. */
  minStep: 120,
  /** A deal or reveal rushes to finish within this once events queue behind it. */
  rushWithin: 400,
} as const;
