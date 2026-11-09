import { describe, expect, it } from 'vitest';
import { CARD_RATIO } from '../tokens';
import { boxesOverlap, handCols, tableLayout, type Box, type TvLayout } from './layout';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

/** Where a hand's cards actually land for these grid positions. */
function cardsBox(layout: TvLayout, id: string, positions: number[]): Box {
  const cols = handCols(positions);
  const boxes = positions.map((pos) => {
    const p = layout.slot(id, pos, cols);
    const w = p.scale * layout.spriteWidth;
    const h = w * CARD_RATIO;
    return { x: p.x - w / 2, y: p.y - h / 2, w, h };
  });
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
    h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
  };
}

const inside = (inner: Box, outer: Box, slack = 0.5) =>
  inner.x >= outer.x - slack &&
  inner.y >= outer.y - slack &&
  inner.x + inner.w <= outer.x + outer.w + slack &&
  inner.y + inner.h <= outer.y + outer.h + slack;

const poseBox = (layout: TvLayout, p: { x: number; y: number; scale: number }): Box => {
  const w = p.scale * layout.spriteWidth;
  const h = w * CARD_RATIO;
  return { x: p.x - w / 2, y: p.y - h / 2, w, h };
};

describe.each([
  [1920, 1080],
  [1280, 720],
])('the TV table at %ix%i', (W, H) => {
  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])(
    '%i seats never overlap each other, the piles, or the edge bars',
    (n) => {
      const layout = tableLayout(W, H, ids(n));
      const stage: Box = {
        x: 0,
        y: layout.bands.top,
        w: W,
        h: H - layout.bands.top - layout.bands.bottom,
      };
      for (const [i, seat] of layout.seats.entries()) {
        expect(inside(seat.box, stage), `seat ${i} on stage`).toBe(true);
        expect(boxesOverlap(seat.box, layout.pileBox), `seat ${i} and the piles`).toBe(false);
        for (const other of layout.seats.slice(i + 1)) {
          expect(boxesOverlap(seat.box, other.box), `seats ${i} and ${other.playerId}`).toBe(false);
        }
        // Dealt, widened by penalties, and with holes: the cards stay inside the seat.
        for (const positions of [
          [0, 1, 2, 3],
          [0, 1, 2, 3, 4, 5],
          [0, 1, 2, 3, 4, 5, 6, 7],
          [1, 3, 5],
        ]) {
          expect(inside(cardsBox(layout, seat.playerId, positions), seat.box)).toBe(true);
        }
        // The drawn card stays clear of the piles and of every other seat.
        const drawn = poseBox(layout, layout.drawn(seat.playerId));
        expect(boxesOverlap(drawn, layout.pileBox), `seat ${i} drawn card`).toBe(false);
        for (const other of layout.seats) {
          if (other === seat) continue;
          expect(boxesOverlap(drawn, other.box), `seat ${i} drawn card on ${other.playerId}`).toBe(
            false,
          );
        }
      }
    },
  );

  it.each([2, 4, 6, 8, 10, 12])('%i seats are mirror-symmetric', (n) => {
    const layout = tableLayout(W, H, ids(n));
    const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
    const spots = new Set(layout.seats.map((s) => key(s.x, s.y)));
    for (const s of layout.seats) expect(spots.has(key(W - s.x, s.y))).toBe(true);
  });

  it('two seats face each other across the piles', () => {
    const [a, b] = tableLayout(W, H, ids(2)).seats;
    expect(a!.y).toBeCloseTo(b!.y, 0);
    expect(a!.x + b!.x).toBeCloseTo(W, 0);
  });

  it('cards stay readable from across a room, biggest with two players', () => {
    const widths = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => tableLayout(W, H, ids(n)).cardW);
    expect(Math.max(...widths)).toBe(widths[0]);
    // Even on a full 12-seat table, a card is over 55 px wide at 1080p.
    for (const w of widths) expect(w * (1080 / H)).toBeGreaterThan(55);
  });
});
