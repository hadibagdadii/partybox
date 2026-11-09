import type { CambioEvent } from '@partybox/cambio';
import { describe, expect, it } from 'vitest';
import { CARD_RATIO, timing } from '../tokens';
import { handCols, MINI_MIN, phoneLayout, posesFor, type PhoneLayout } from './layout';
import type { Scene } from './scene';
import { applyEvent } from './steps';

const face = { rank: '7', suit: 'hearts' } as const;
const king = { rank: 'K', suit: 'spades' } as const;

/** Three players, four cards each: you, b, c. Slot `${p}${i}` holds card `${p}c${i}`. */
function table(): Scene {
  return {
    round: 1,
    seats: ['you', 'b', 'c'].map((p) => ({
      playerId: p,
      slots: [0, 1, 2, 3].map((i) => ({ slotId: `${p}${i}`, cardId: `${p}c${i}`, pos: i })),
    })),
    drawn: null,
    discard: [{ cardId: 'top', face: king }],
    deckCount: 30,
    discardCount: 1,
    discardChain: 0,
    revealed: {},
    peek: null,
    callerId: null,
  };
}
const cardAt = (s: Scene, slotId: string) =>
  s.seats.flatMap((x) => x.slots).find((x) => x.slotId === slotId)?.cardId;

describe('table motion on the phone', () => {
  it.each(['blindSwap', 'kingSwap'] as const)(
    'a %s with your hand ends with each card in the other slot, both arcing',
    (type) => {
      const event = {
        type,
        playerId: 'c',
        a: { playerId: 'you', slotId: 'you2', cardId: 'youc2' },
        b: { playerId: 'b', slotId: 'b1', cardId: 'bc1' },
        ...(type === 'blindSwap' ? { power: 'swapAny' } : {}),
      } as unknown as CambioEvent;
      const { scene, step } = applyEvent(table(), event);
      expect(cardAt(scene, 'you2')).toBe('bc1');
      expect(cardAt(scene, 'b1')).toBe('youc2');
      expect(step.moves.map((m) => [m.cardId, m.path])).toEqual([
        ['youc2', 'arc'],
        ['bc1', 'arc'],
      ]);
      // On the phone the two cards really travel between the strip and your hand.
      const l = phoneLayout(375, 740, ['you', 'b', 'c'], 'you');
      const before = posesFor(step.before, l);
      const after = posesFor(scene, l);
      expect(after.get('bc1')).toEqual(before.get('youc2') && l.slot('you', 2, 2));
      expect(after.get('youc2')).toEqual(l.slot('b', 1, 2));
      expect(before.get('youc2')!.y).toBeGreaterThan(before.get('bc1')!.y + 200);
    },
  );

  it('a peek holds about a second, lifted and tilted toward the peeker', () => {
    const event: CambioEvent = {
      type: 'powerUsed',
      playerId: 'c',
      power: 'peekOther',
      target: { playerId: 'b', slotId: 'b0', cardId: 'bc0' },
    };
    const { scene, step } = applyEvent(table(), event);
    expect(step.kind).toBe('peek');
    expect(step.duration).toBe(timing.peekHold);
    expect(step.duration).toBeGreaterThanOrEqual(900);
    const l = phoneLayout(375, 740, ['you', 'b', 'c'], 'you');
    const rest = l.slot('b', 0, 2);
    const lifted = posesFor(scene, l).get('bc0')!;
    expect(lifted.y).toBeLessThan(rest.y);
    expect(lifted.scale).toBeGreaterThan(rest.scale * 1.3);
    expect(Math.abs(lifted.rotateY ?? 0) + Math.abs(lifted.rotateX ?? 0)).toBeGreaterThan(0);
  });

  it('someone peeking at your card tilts it toward them, up the screen', () => {
    const { scene } = applyEvent(table(), {
      type: 'powerUsed',
      playerId: 'b',
      power: 'peekOther',
      target: { playerId: 'you', slotId: 'you0', cardId: 'youc0' },
    });
    const l = phoneLayout(375, 740, ['you', 'b', 'c'], 'you');
    const rest = l.slot('you', 0, 2);
    const lifted = posesFor(scene, l).get('youc0')!;
    expect(lifted.y).toBeLessThan(rest.y);
    expect(lifted.rotateX).toBeGreaterThan(0);
  });

  it('cards thrown to the discard turn face up partway through the flight', () => {
    const s = table();
    s.drawn = { playerId: 'b', cardId: 'd1' };
    const swap = applyEvent(s, {
      type: 'swapped',
      playerId: 'b',
      slotId: 'b3',
      cardId: 'd1',
      discarded: { cardId: 'bc3', face },
    }).step;
    const out = swap.moves.find((m) => m.cardId === 'bc3')!;
    expect(out.path).toBe('arc');
    const flip = swap.flips.find((f) => f.cardId === 'bc3')!;
    expect(flip.rotateY).toEqual([180, 0]);
    expect(flip.delay).toBeGreaterThan(out.delay);
    expect(flip.delay).toBeLessThan(out.delay + out.duration);
    expect(cardAt(swap.after, 'b3')).toBe('d1');

    const snap = applyEvent(table(), {
      type: 'snapped',
      snapperId: 'b',
      ownerId: 'c',
      slotId: 'c1',
      card: { cardId: 'cc1', face },
      give: { slotId: 'b2', cardId: 'bc2' },
    } as CambioEvent).step;
    expect(snap.flips.map((f) => f.cardId)).toEqual(['cc1']);
    const give = snap.moves.find((m) => m.cardId === 'bc2')!;
    expect(give.path).toBe('arc');
    expect(cardAt(snap.after, 'c1')).toBe('bc2');
  });

  it('a wrong snap flips the card up in place, shakes it, flips it back, then the penalty', () => {
    const { step } = applyEvent(table(), {
      type: 'snapFailed',
      snapperId: 'b',
      ownerId: 'c',
      slotId: 'c0',
      card: { cardId: 'cc0', face },
      penalty: { slotId: 'bp', cardId: 'pen', pos: 4 },
    } as CambioEvent);
    expect(step.flips[0]!.rotateY).toEqual([180, 0, 0, 180]);
    expect(step.effects.find((e) => e.kind === 'shake')).toMatchObject({ cardId: 'cc0' });
    const pen = step.moves.find((m) => m.cardId === 'pen')!;
    expect(pen.fromDeck).toBe(true);
    expect(pen.delay).toBeGreaterThanOrEqual(step.flips[0]!.duration - 200);
  });
});

describe('the phone strip at 375 px', () => {
  type Rect = { l: number; r: number; t: number; b: number };
  const overlap = (a: Rect, b: Rect) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

  /** The cards of one mini hand, as laid out for its current columns. */
  function cardsOf(l: PhoneLayout, id: string, positions: number[]): Rect[] {
    const cols = handCols(positions);
    return positions.map((pos) => {
      const p = l.slot(id, pos, cols);
      const w = p.scale * l.spriteWidth;
      const h = w * CARD_RATIO;
      return { l: p.x - w / 2, r: p.x + w / 2, t: p.y - h / 2, b: p.y + h / 2 };
    });
  }

  const hands = {
    dealt: () => [0, 1, 2, 3],
    // Every third hand took penalties: three and four columns.
    penalties: (i: number) =>
      i % 3 === 1 ? [0, 1, 2, 3, 4, 5] : i % 3 === 2 ? [0, 1, 3, 4, 6] : [0, 1, 2, 3],
  };

  describe.each([667, 740, 812])('375x%i', (H) => {
    it.each(
      Array.from({ length: 11 }, (_, i) => i + 2).flatMap((n) =>
        Object.keys(hands).map((k) => [n, k] as const),
      ),
    )('%i players, %s hands: no overlap, readable, your hand biggest', (n, kind) => {
      const ids = ['you', ...Array.from({ length: n - 1 }, (_, i) => `p${i}`)];
      const pos = (i: number) => hands[kind as keyof typeof hands](i);
      const cols = Object.fromEntries(ids.slice(1).map((id, i) => [id, handCols(pos(i))]));
      const l = phoneLayout(375, H, ids, 'you', cols);
      const strip = l.regions.strip;
      expect(strip.hands).toHaveLength(n - 1);
      expect(strip.rows).toBeGreaterThanOrEqual(Math.ceil((n - 1) / 6));
      if (kind === 'dealt') expect(strip.rows).toBe(Math.ceil((n - 1) / 6));
      expect(strip.rows).toBeLessThanOrEqual(3);
      expect(strip.miniW).toBeGreaterThanOrEqual(MINI_MIN);

      const boxes = strip.hands.map((b) => ({ l: b.x, r: b.x + b.w, t: b.y, b: b.y + b.h }));
      for (const [i, box] of boxes.entries()) {
        expect(box.l, `hand ${i}`).toBeGreaterThanOrEqual(0);
        expect(box.r, `hand ${i}`).toBeLessThanOrEqual(375);
        expect(box.b).toBeLessThanOrEqual(strip.bottom);
        for (let j = i + 1; j < boxes.length; j++)
          expect(overlap(box, boxes[j]!), `hands ${i} and ${j}`).toBe(false);
        // Every card sits inside its own hand's box.
        for (const c of cardsOf(l, strip.hands[i]!.playerId, pos(i))) {
          expect(c.l).toBeGreaterThanOrEqual(box.l - 0.01);
          expect(c.r).toBeLessThanOrEqual(box.r + 0.01);
          expect(c.t).toBeGreaterThanOrEqual(box.t + 15);
          expect(c.b).toBeLessThanOrEqual(box.b + 0.01);
        }
      }
      // The strip ends above the piles; the action bar stays in the bottom third.
      const pileTop = l.deck.y - (l.deck.scale * l.spriteWidth * CARD_RATIO) / 2;
      expect(strip.bottom).toBeLessThan(pileTop);
      expect(l.regions.actionTop).toBeGreaterThanOrEqual((H * 2) / 3);
      // Your own cards are the biggest thing on screen.
      const yours = l.regions.handCardW(2);
      expect(yours).toBeGreaterThan(strip.miniW * 1.5);
      expect(yours).toBeGreaterThan(l.regions.drawnW);
      expect(yours).toBeGreaterThan(l.deck.scale * l.spriteWidth);
    });
  });
});
