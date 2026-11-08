import type { CambioEvent, Face } from '@partybox/cambio';
import { timing } from '../tokens';
import { DISCARD_KEEP, type Scene } from './scene';

export type StepKind =
  | 'deal'
  | 'draw'
  | 'swap'
  | 'discard'
  | 'peek'
  | 'blindSwap'
  | 'snap'
  | 'snapGive'
  | 'wrongSnap'
  | 'reshuffle'
  | 'call'
  | 'reveal'
  | 'quiet';

/** How one card travels during a step. Times are ms from the step's start. */
export interface CardMove {
  cardId: string;
  /** `spring` slides, `arc` curves past other cards, `slam` arcs and lands hard. */
  path: 'spring' | 'arc' | 'slam';
  delay: number;
  duration: number;
  /** The card is new: it starts face down on top of the deck. */
  fromDeck?: boolean;
  /** Which side an arc bulges to, so two swapped cards pass each other. */
  bend?: 1 | -1;
}

/** A staged flip on a card whose face everyone may see. rotateY: 0 shows the face, 180 the back. */
export interface CardFlip {
  cardId: string;
  face: Face;
  rotateY: number[];
  times?: number[];
  delay: number;
  duration: number;
}

export type Effect =
  | { kind: 'pileShake'; delay: number }
  | { kind: 'impact'; delay: number }
  | { kind: 'shake'; cardId: string; delay: number; duration: number }
  | { kind: 'sweep'; count: number; delay: number; duration: number }
  | { kind: 'seatPulse'; playerId: string; delay: number };

export interface Step {
  kind: StepKind;
  event: CambioEvent;
  before: Scene;
  after: Scene;
  /** Base length in ms; the queue may play it faster. */
  duration: number;
  /** Deals and reveals: long by nature, played in full unless newer motion queues behind them. */
  long: boolean;
  moves: CardMove[];
  flips: CardFlip[];
  effects: Effect[];
  /** Cards this step moved or turned, for the reduced-motion highlight. */
  touched: string[];
}

const clone = (s: Scene): Scene => ({
  ...s,
  seats: s.seats.map((seat) => ({
    playerId: seat.playerId,
    slots: seat.slots.map((x) => ({ ...x })),
  })),
  drawn: s.drawn && { ...s.drawn },
  discard: s.discard.map((c) => ({ cardId: c.cardId, face: { ...c.face } })),
  revealed: { ...s.revealed },
  peek: s.peek && { ...s.peek },
});

const seatOf = (s: Scene, playerId: string) => s.seats.find((x) => x.playerId === playerId);

function findSlot(s: Scene, slotId: string) {
  for (const seat of s.seats) {
    const i = seat.slots.findIndex((x) => x.slotId === slotId);
    if (i >= 0) return { seat, index: i, slot: seat.slots[i]! };
  }
  return null;
}

function pushDiscard(s: Scene, card: { cardId: string; face: Face }): void {
  s.discard.push({ cardId: card.cardId, face: { ...card.face } });
  if (s.discard.length > DISCARD_KEEP) s.discard.splice(0, s.discard.length - DISCARD_KEEP);
  s.discardCount += 1;
}

/** Stagger between dealt cards: at most 60 ms, less on big tables so a deal stays near 1.4 s. */
export const dealStagger = (cards: number): number =>
  Math.min(timing.dealStaggerMax, timing.dealSpread / Math.max(cards, 1));

/**
 * Applies one public event to the scene and describes how to animate it. Pure: the same scene
 * and event always give the same step. Unknown slots or cards (a scene that drifted) are skipped
 * rather than thrown on; the queue settles to the real state afterwards.
 */
export function applyEvent(prev: Scene, event: CambioEvent): { scene: Scene; step: Step } {
  const s = clone(prev);
  const step: Step = {
    kind: 'quiet',
    event,
    before: prev,
    after: s,
    duration: 0,
    long: false,
    moves: [],
    flips: [],
    effects: [],
    touched: [],
  };
  const done = (patch: Partial<Step>) => {
    Object.assign(step, patch);
    step.touched = [
      ...new Set([
        ...step.moves.map((m) => m.cardId),
        ...step.flips.map((f) => f.cardId),
        ...step.touched,
      ]),
    ];
    return { scene: s, step };
  };

  switch (event.type) {
    case 'dealt': {
      s.round = event.round;
      s.seats = event.hands.map((h) => ({
        playerId: h.playerId,
        slots: h.slots.map((x) => ({ ...x })),
      }));
      s.drawn = null;
      s.discard = [{ cardId: event.discard.cardId, face: { ...event.discard.face } }];
      s.discardCount = 1;
      s.deckCount = event.deckCount;
      s.revealed = {};
      s.peek = null;
      s.callerId = null;
      // One card to each seat in turn, pass after pass, then the first discard.
      const passes = Math.max(0, ...event.hands.map((h) => h.slots.length));
      const total = event.hands.reduce((n, h) => n + h.slots.length, 0) + 1;
      const gap = dealStagger(total);
      const moves: CardMove[] = [];
      let order = 0;
      for (let pass = 0; pass < passes; pass++) {
        for (const h of event.hands) {
          const slot = h.slots[pass];
          if (!slot) continue;
          moves.push({
            cardId: slot.cardId,
            path: 'spring',
            delay: order++ * gap,
            duration: timing.dealFlight,
            fromDeck: true,
          });
        }
      }
      moves.push({
        cardId: event.discard.cardId,
        path: 'arc',
        delay: order * gap,
        duration: timing.dealFlight,
        fromDeck: true,
        bend: 1,
      });
      return done({
        kind: 'deal',
        long: true,
        moves,
        duration: order * gap + timing.dealFlight + timing.flip,
      });
    }

    case 'drew': {
      s.drawn = { playerId: event.playerId, cardId: event.cardId };
      s.deckCount = Math.max(0, s.deckCount - 1);
      return done({
        kind: 'draw',
        duration: timing.draw,
        moves: [
          { cardId: event.cardId, path: 'spring', delay: 0, duration: timing.draw, fromDeck: true },
        ],
      });
    }

    case 'swapped': {
      const at = findSlot(s, event.slotId);
      const old = at?.slot.cardId ?? event.discarded.cardId;
      if (at) at.slot.cardId = event.cardId;
      s.drawn = null;
      pushDiscard(s, event.discarded);
      return done({
        kind: 'swap',
        duration: Math.max(timing.slide, 60 + timing.exitArc + timing.flip / 2),
        moves: [
          { cardId: event.cardId, path: 'spring', delay: 0, duration: timing.slide },
          { cardId: old, path: 'arc', delay: 60, duration: timing.exitArc, bend: 1 },
        ],
      });
    }

    case 'discardedDrawn': {
      s.drawn = null;
      pushDiscard(s, event.card);
      return done({
        kind: 'discard',
        duration: timing.exitArc + timing.flip / 2,
        moves: [
          { cardId: event.card.cardId, path: 'arc', delay: 0, duration: timing.exitArc, bend: -1 },
        ],
      });
    }

    case 'powerUsed':
    case 'kingPeek': {
      s.peek = { playerId: event.playerId, slotId: event.target.slotId };
      return done({ kind: 'peek', duration: timing.peek, touched: [event.target.cardId] });
    }

    case 'blindSwap':
    case 'kingSwap': {
      const a = findSlot(s, event.a.slotId);
      const b = findSlot(s, event.b.slotId);
      if (a && b) {
        a.slot.cardId = event.b.cardId;
        b.slot.cardId = event.a.cardId;
      }
      s.peek = null;
      return done({
        kind: 'blindSwap',
        duration: timing.arc,
        moves: [
          { cardId: event.a.cardId, path: 'arc', delay: 0, duration: timing.arc, bend: 1 },
          { cardId: event.b.cardId, path: 'arc', delay: 0, duration: timing.arc, bend: 1 },
        ],
      });
    }

    case 'snapped': {
      const at = findSlot(s, event.slotId);
      const moves: CardMove[] = [
        { cardId: event.card.cardId, path: 'slam', delay: 0, duration: timing.snapFlight },
      ];
      if (event.give) {
        const given = findSlot(s, event.give.slotId);
        if (given) given.seat.slots.splice(given.index, 1);
        const target = findSlot(s, event.slotId);
        if (target) target.slot.cardId = event.give.cardId;
        moves.push({
          cardId: event.give.cardId,
          path: 'spring',
          delay: timing.snapFlight - 80,
          duration: timing.give,
        });
      } else if (at) {
        at.seat.slots.splice(at.index, 1);
      }
      pushDiscard(s, event.card);
      const effects: Effect[] = [
        { kind: 'impact', delay: timing.snapFlight },
        { kind: 'pileShake', delay: timing.snapFlight },
      ];
      return done({
        kind: event.give ? 'snapGive' : 'snap',
        duration: event.give ? timing.snapFlight - 80 + timing.give : timing.snapFlight + 160,
        moves,
        effects,
      });
    }

    case 'snapFailed': {
      const show = timing.flip * 2 + timing.shake;
      const flips: CardFlip[] = [
        {
          cardId: event.card.cardId,
          face: { ...event.card.face },
          rotateY: [180, 0, 0, 180],
          times: [0, timing.flip / show, (timing.flip + timing.shake) / show, 1],
          delay: 0,
          duration: show,
        },
      ];
      const effects: Effect[] = [
        { kind: 'shake', cardId: event.card.cardId, delay: timing.flip, duration: timing.shake },
      ];
      const moves: CardMove[] = [];
      let duration = show;
      if (event.penalty) {
        const seat = seatOf(s, event.snapperId);
        if (seat) {
          // Into its own grid position: a hole first, the end of the grid otherwise.
          seat.slots.push({ ...event.penalty });
          seat.slots.sort((a, b) => a.pos - b.pos);
        }
        s.deckCount = Math.max(0, s.deckCount - 1);
        const delay = show - 120;
        moves.push({
          cardId: event.penalty.cardId,
          path: 'spring',
          delay,
          duration: timing.penalty,
          fromDeck: true,
        });
        duration = delay + timing.penalty;
      }
      return done({ kind: 'wrongSnap', duration, flips, moves, effects });
    }

    case 'reshuffled': {
      const buried = Math.max(0, prev.discardCount - 1);
      s.discard = s.discard.slice(-1);
      s.discardCount = s.discard.length;
      s.deckCount = event.deckCount;
      return done({
        kind: 'reshuffle',
        duration: timing.sweep,
        effects: [{ kind: 'sweep', count: Math.min(8, buried), delay: 0, duration: timing.sweep }],
      });
    }

    case 'cambioCalled': {
      s.callerId = event.playerId;
      return done({
        kind: 'call',
        duration: timing.call,
        effects: [{ kind: 'seatPulse', playerId: event.playerId, delay: 0 }],
      });
    }

    case 'roundRevealed': {
      s.drawn = null;
      s.peek = null;
      const flips: CardFlip[] = [];
      const order = s.seats.map((x) => x.playerId);
      const hands = [...event.result.hands].sort(
        (a, b) => order.indexOf(a.playerId) - order.indexOf(b.playerId),
      );
      hands.forEach((hand, seatIndex) => {
        for (const c of hand.cards) {
          s.revealed[c.cardId] = { ...c.face };
          flips.push({
            cardId: c.cardId,
            face: { ...c.face },
            rotateY: [180, 0],
            delay: seatIndex * timing.revealStagger,
            duration: timing.revealFlip,
          });
        }
      });
      return done({
        kind: 'reveal',
        long: true,
        flips,
        duration: Math.max(0, hands.length - 1) * timing.revealStagger + timing.revealFlip,
      });
    }

    case 'turnStarted':
      s.peek = null;
      s.drawn = null;
      return done({});

    case 'ready':
    case 'powerSkipped':
    case 'gameOver':
      return done({});
  }
}

/** Folds events into steps, starting from `scene`. */
export function stepsFor(
  scene: Scene,
  events: readonly CambioEvent[],
): { scene: Scene; steps: Step[] } {
  const steps: Step[] = [];
  let s = scene;
  for (const e of events) {
    const r = applyEvent(s, e);
    steps.push(r.step);
    s = r.scene;
  }
  return { scene: s, steps };
}
