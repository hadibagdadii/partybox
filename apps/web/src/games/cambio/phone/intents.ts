import type { CambioAction, CambioPlayerView } from '@partybox/cambio';

export type Of<T extends CambioAction['type']> = Extract<CambioAction, { type: T }>;
export type SnapAction = Of<'snap'>;

/**
 * What the phone may offer right now, read only from the server's `legalActions`. The browser
 * holds no rules: a button or target exists exactly when an action for it is legal.
 */
export interface Intents {
  ready: boolean;
  continue: boolean;
  draw: boolean;
  call: boolean;
  discard: boolean;
  donePeek: boolean;
  /** `skipPower`: skips a power, or keeps the card after a black King peek. */
  skip: boolean;
  /** Slot ids a drawn card may be swapped into. */
  swap: Set<string>;
  /** Slot ids a peek power may target. */
  peek: Set<string>;
  /** Legal blind swaps (Jack and Queen), as slot id pairs. */
  blindPairs: [string, string][];
  /** Slot ids the black King may swap the peeked card with. */
  kingSwap: Set<string>;
  /** Snaps on your own cards, by slot id. */
  ownSnaps: Map<string, SnapAction>;
  /**
   * Snaps on other players' cards, by slot id: one action per card you could give, or a single
   * action without a give when your hand is empty.
   */
  otherSnaps: Map<string, SnapAction[]>;
}

export function intentsOf(view: CambioPlayerView): Intents {
  const me = view.you?.id ?? null;
  const mine = new Set(view.players.find((p) => p.id === me)?.slots.map((s) => s.slotId) ?? []);
  const out: Intents = {
    ready: false,
    continue: false,
    draw: false,
    call: false,
    discard: false,
    donePeek: false,
    skip: false,
    swap: new Set(),
    peek: new Set(),
    blindPairs: [],
    kingSwap: new Set(),
    ownSnaps: new Map(),
    otherSnaps: new Map(),
  };
  for (const a of view.legalActions) {
    switch (a.type) {
      case 'ready':
        out.ready = true;
        break;
      case 'continue':
        out.continue = true;
        break;
      case 'draw':
        out.draw = true;
        break;
      case 'callCambio':
        out.call = true;
        break;
      case 'discard':
        out.discard = true;
        break;
      case 'donePeek':
        out.donePeek = true;
        break;
      case 'skipPower':
        out.skip = true;
        break;
      case 'swap':
        out.swap.add(a.slotId);
        break;
      case 'peek':
        out.peek.add(a.slotId);
        break;
      case 'blindSwap':
        out.blindPairs.push(a.slotIds);
        break;
      case 'kingSwap':
        out.kingSwap.add(a.slotId);
        break;
      case 'snap':
        if (mine.has(a.slotId)) out.ownSnaps.set(a.slotId, a);
        else out.otherSnaps.set(a.slotId, [...(out.otherSnaps.get(a.slotId) ?? []), a]);
        break;
    }
  }
  return out;
}

/** Cards that can start a blind swap. */
export function blindFirsts(pairs: readonly [string, string][]): Set<string> {
  return new Set(pairs.flatMap(([a, b]) => [a, b]));
}

/** Cards that may complete a blind swap started on `first`. */
export function blindSeconds(pairs: readonly [string, string][], first: string): Set<string> {
  const out = new Set<string>();
  for (const [a, b] of pairs) {
    if (a === first) out.add(b);
    if (b === first) out.add(a);
  }
  return out;
}

/** The legal blind swap between two picks, in whichever order the server listed it. */
export function blindPair(
  pairs: readonly [string, string][],
  x: string,
  y: string,
): [string, string] | null {
  return pairs.find(([a, b]) => (a === x && b === y) || (a === y && b === x)) ?? null;
}

/**
 * Turns left after Cambio: everyone from the current player up to (not including) the caller.
 * Zero when nobody has called or the round is not in play.
 */
export function turnsLeft(view: Pick<CambioPlayerView, 'players' | 'turn' | 'callerId'>): number {
  if (!view.callerId || !view.turn) return 0;
  const order = view.players.map((p) => p.id);
  const caller = order.indexOf(view.callerId);
  const current = order.indexOf(view.turn.playerId);
  if (caller < 0 || current < 0) return 0;
  return (caller - current + order.length) % order.length;
}
