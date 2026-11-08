import { createRng, type ReduceResult } from '@partybox/shared';
import type { CambioAction } from './actions.js';
import type { Face } from './cards.js';
import type { Rank, Suit } from './ids.js';
import type { CambioOptions } from './options.js';
import { reduce } from './reduce.js';
import { assignCardIds, createInitialState, newSlot } from './setup.js';
import type { CambioEvent, CambioState, Slot } from './state.js';

/** Seat ids are p0..p(n-1). */
export const pid = (seat: number): string => `p${seat}`;

/** A face; black (spades) unless a suit is given. Jokers have no suit. */
export const card = (rank: Rank, suit: Suit = 'spades'): Face => ({
  rank,
  suit: rank === 'joker' ? null : suit,
});

/** `count` copies of a no-power card, handy for stacking the deck. */
export const fillers = (count: number, rank: Rank = '2'): Face[] =>
  Array.from({ length: count }, () => card(rank));

export interface Setup {
  count?: number;
  seed?: number;
  options?: Partial<CambioOptions>;
  /** Replaces each listed player's hand with these faces, in slot order. */
  hands?: (Face[] | undefined)[];
  /** Top of the deck first. Defaults to 20 Twos. */
  deck?: Face[];
  /** The discard pile, top card last. */
  discard?: Face[];
  /** Seat whose turn it is. */
  first?: number;
  /** Keep the initial peek instead of skipping straight to play. */
  peek?: boolean;
  /** Mark every player as having taken a turn, so Cambio can be called. */
  played?: boolean;
}

/** A scripted game: known hands, a stacked deck and discard, and a chosen first player. */
export function makeGame(opts: Setup = {}): CambioState {
  const count = opts.count ?? 3;
  const seats = Array.from({ length: count }, (_, i) => ({ id: pid(i), name: `Player ${i}` }));
  const s = createInitialState(seats, createRng(opts.seed ?? 1), opts.options ?? {});
  const rng = createRng(12345);
  opts.hands?.forEach((faces, i) => {
    if (!faces) return;
    const p = s.players[i]!;
    p.hand = assignCardIds(s, faces, rng).map((c, i) => newSlot(s, c, i));
    s.peekSlotIds[p.id] = p.hand.slice(2, 4).map((slot) => slot.id);
  });
  s.deck = assignCardIds(s, opts.deck ?? fillers(20), rng);
  if (opts.discard) s.discard = assignCardIds(s, opts.discard, rng);
  const first = opts.first ?? 0;
  s.turn = { playerId: pid(first), stage: 'start', drawn: null, power: null, peek: null };
  if (!opts.peek) {
    s.phase = 'play';
    s.readyIds = s.players.map((p) => p.id);
  }
  if (opts.played) for (const p of s.players) s.completedTurns[p.id] = 1;
  return s;
}

export function attempt(
  s: CambioState,
  playerId: string,
  action: CambioAction,
  seed = 99,
): ReduceResult<CambioState, CambioEvent> {
  return reduce(s, { playerId, action }, createRng(seed));
}

/** Applies an action that must succeed. */
export function act(s: CambioState, playerId: string, action: CambioAction): CambioState {
  const result = attempt(s, playerId, action);
  if (!result.ok) throw new Error(`${playerId} ${action.type}: ${result.error.message}`);
  return result.state;
}

/** Applies an action that must succeed and returns its events too. */
export function actE(
  s: CambioState,
  playerId: string,
  action: CambioAction,
): { s: CambioState; events: CambioEvent[] } {
  const result = attempt(s, playerId, action);
  if (!result.ok) throw new Error(`${playerId} ${action.type}: ${result.error.message}`);
  return { s: result.state, events: result.events };
}

export const slot = (s: CambioState, seat: number, index: number): Slot => {
  const found = s.players[seat]?.hand[index];
  if (!found) throw new Error(`no slot ${index} for seat ${seat}`);
  return found;
};

export const top = (s: CambioState): Face => s.discard[s.discard.length - 1]!.face;

/** A snap of seat `seat`'s card at `index`, by its current card id. */
export const snapAt = (
  s: CambioState,
  seat: number,
  index: number,
  giveSlotId?: string,
): CambioAction => {
  const target = slot(s, seat, index);
  return giveSlotId === undefined
    ? { type: 'snap', slotId: target.id, cardId: target.card.id }
    : { type: 'snap', slotId: target.id, cardId: target.card.id, giveSlotId };
};

/** The current player draws and discards, skipping any power. */
export function drawAndDiscard(s: CambioState): CambioState {
  const actor = s.turn!.playerId;
  let next = act(s, actor, { type: 'draw' });
  next = act(next, actor, { type: 'discard' });
  if (next.turn?.playerId === actor && next.turn.stage === 'power') {
    next = act(next, actor, { type: 'skipPower' });
  }
  return next;
}

/** The current player calls Cambio and everyone else draws and discards; the round ends. */
export function callAndFinish(s: CambioState): CambioState {
  let next = act(s, s.turn!.playerId, { type: 'callCambio' });
  while (next.phase === 'play') next = drawAndDiscard(next);
  return next;
}

export const lastEvent = (s: CambioState): CambioEvent | undefined => s.log[s.log.length - 1];

/** Every `{cardId, face}` pair anywhere inside a value, such as a view. */
export function facesIn(value: unknown, out: { cardId: string; face: Face }[] = []) {
  if (Array.isArray(value)) {
    for (const v of value) facesIn(v, out);
  } else if (value !== null && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.cardId === 'string' && o.face && typeof o.face === 'object') {
      out.push({ cardId: o.cardId, face: o.face as Face });
    }
    for (const v of Object.values(o)) facesIn(v, out);
  }
  return out;
}
