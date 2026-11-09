import type {
  CambioEvent,
  CambioHostView,
  CambioPlayerView,
  Face,
  PublicCard,
} from '@partybox/cambio';

export interface SceneSlot {
  slotId: string;
  cardId: string;
  /** Grid position in the hand; see the engine's RULES.md note 13. */
  pos: number;
}

/** Where every card on the table is, as the screen should draw it. Public information only. */
export interface Scene {
  round: number;
  /** Seat order, each hand sorted by grid position. Positions keep gaps where cards left. */
  seats: { playerId: string; slots: SceneSlot[] }[];
  /** The card the current player holds after drawing, face down to everyone else. */
  drawn: { playerId: string; cardId: string } | null;
  /** The top few cards of the discard pile, top card last. Buried cards are not tracked. */
  discard: PublicCard[];
  /** Snaps stacked on the discard since the last card was discarded or dealt to it. */
  discardChain: number;
  deckCount: number;
  discardCount: number;
  /** Hand cards shown face up to everyone: the round reveal. */
  revealed: Record<string, Face>;
  /** A card being peeked at right now, and who is peeking. */
  peek: { playerId: string; slotId: string } | null;
  callerId: string | null;
}

/** How many discard cards stay mounted under the top, for a natural-looking pile. */
export const DISCARD_KEEP = 4;

/** Events that put a card on the discard other than a snap, which start a new chain. */
const CHAIN_BREAKS = new Set<CambioEvent['type']>([
  'dealt',
  'swapped',
  'discardedDrawn',
  'reshuffled',
]);

/** Snaps on the discard since the last card was discarded, read from the round's log. */
export function chainIn(log: readonly CambioEvent[]): number {
  let n = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!;
    if (CHAIN_BREAKS.has(e.type)) break;
    if (e.type === 'snapped') n += 1;
  }
  return n;
}

export function sceneFromView(view: CambioHostView): Scene {
  const turn = view.turn;
  const revealed: Record<string, Face> = {};
  const between = view.phase === 'roundOver' || view.phase === 'over';
  if (between && view.lastRound?.round === view.round) {
    for (const hand of view.lastRound.hands) {
      for (const c of hand.cards) revealed[c.cardId] = { ...c.face };
    }
  }
  return {
    round: view.round,
    seats: view.players.map((p) => ({
      playerId: p.id,
      slots: p.slots.map((s) => ({ slotId: s.slotId, cardId: s.cardId, pos: s.pos })),
    })),
    drawn: turn?.drawnCardId ? { playerId: turn.playerId, cardId: turn.drawnCardId } : null,
    discard: view.topDiscard
      ? [{ cardId: view.topDiscard.cardId, face: { ...view.topDiscard.face } }]
      : [],
    discardChain: chainIn(view.log),
    deckCount: view.deckCount,
    discardCount: view.discardCount,
    revealed,
    peek: turn?.peekSlotId ? { playerId: turn.playerId, slotId: turn.peekSlotId } : null,
    callerId: view.callerId,
  };
}

/** Faces only this player may see right now: their drawn card and what they are peeking at. */
export function privateFaces(view: CambioPlayerView): Record<string, Face> {
  const out: Record<string, Face> = {};
  if (view.drawn) out[view.drawn.cardId] = { ...view.drawn.face };
  for (const p of view.peeks) out[p.cardId] = { ...p.face };
  return out;
}

/** The parts of a scene that must match the real state; buried discard cards are not known. */
export function sceneKey(s: Scene) {
  return {
    round: s.round,
    seats: s.seats,
    drawn: s.drawn,
    top: s.discard[s.discard.length - 1] ?? null,
    chain: s.discardChain,
    deckCount: s.deckCount,
    discardCount: s.discardCount,
    revealed: Object.entries(s.revealed).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    peek: s.peek,
    callerId: s.callerId,
  };
}

export const sameScene = (a: Scene, b: Scene): boolean =>
  JSON.stringify(sceneKey(a)) === JSON.stringify(sceneKey(b));

/** Every card id the scene draws: hands, the drawn card, and the tracked discard. */
export function cardIdsIn(s: Scene): string[] {
  const ids = s.seats.flatMap((seat) => seat.slots.map((x) => x.cardId));
  if (s.drawn) ids.push(s.drawn.cardId);
  for (const c of s.discard) ids.push(c.cardId);
  return ids;
}
