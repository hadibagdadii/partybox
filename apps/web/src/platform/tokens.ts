/**
 * Partybox's own look, for the pages around the games: landing, join, the host lobby, About.
 * Neutral on purpose: no court gold, no card-table felt. Each game keeps its own theme inside.
 */
export const colors = {
  /** Page background: a deep plum, the room with the lights down. */
  night: '#1d1029',
  /** Raised surfaces: panels, inputs, list rows. */
  dusk: '#2b1a3d',
  /** Borders and quiet dividers on dusk. */
  line: '#4a3363',
  /** Body text. */
  paper: '#f6effb',
  /** Secondary text. */
  lavender: '#c3b4da',
  /** The one accent: primary buttons, the room code, focus. */
  punch: '#ff6fae',
  punchDeep: '#ff4f9a',
  /** Text on punch. */
  ink: '#1d1029',
  danger: '#c0303c',
  /** The confetti on the lid of the mark. Decoration only, never text. */
  confetti: ['#ff6fae', '#ffc94d', '#58d6c9', '#9d8cff'],
} as const;

/** Each game's chip color on the landing page: a hint of the theme waiting inside. */
export const gameAccents: Record<string, string> = {
  diwan: '#d9a441',
  cambio: '#2f8f6b',
};
