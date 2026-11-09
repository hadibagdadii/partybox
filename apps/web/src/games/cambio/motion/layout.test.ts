import { describe, expect, it } from 'vitest';
import { SWIPE_MIN } from '../phone/gesture';
import { CARD_RATIO } from '../tokens';
import { handCols, phoneLayout, RULES_CHIP, type Box } from './layout';

const PHONES: [number, number][] = [
  [320, 568],
  [375, 667],
  [375, 812],
  [390, 844],
  [430, 932],
];

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Your card's hit button, as HandHits draws it: the card's own box. */
function handHit(l: ReturnType<typeof phoneLayout>, pos: number, cols: number): Box {
  const pose = l.slot('you', pos, cols);
  const w = pose.scale * l.spriteWidth;
  const h = w * CARD_RATIO;
  return { x: pose.x - w / 2, y: pose.y - h / 2, w, h };
}

/** Where a swipe up from a card travels: the card plus three swipe lengths above it. */
const swipeZone = (b: Box): Box => ({ ...b, y: b.y - 3 * SWIPE_MIN, h: b.h + 3 * SWIPE_MIN });

describe('the Rules chip', () => {
  for (const [w, h] of PHONES) {
    for (let n = 2; n <= 12; n++) {
      for (const handSize of [4, 6]) {
        it(`clears the hand, the snap zone, and the strip: ${w}×${h}, ${n} seats, ${handSize} cards`, () => {
          const ids = ['you', ...Array.from({ length: n - 1 }, (_, i) => `p${i}`)];
          const positions = Array.from({ length: handSize }, (_, i) => i);
          const cols = handCols(positions);
          // Every other hand grown by penalties too, the widest strip there is.
          const colsBy = Object.fromEntries(ids.map((id) => [id, cols]));
          const l = phoneLayout(w, h, ids, 'you', colsBy);
          const chip = l.regions.strip.rulesChip;
          expect(chip.w).toBeGreaterThanOrEqual(RULES_CHIP);
          expect(chip.h).toBeGreaterThanOrEqual(RULES_CHIP);
          expect(chip.x + chip.w).toBeLessThanOrEqual(w);
          for (const pos of positions) {
            const hit = handHit(l, pos, cols);
            expect(overlaps(chip, hit), `card ${pos}`).toBe(false);
            expect(overlaps(chip, swipeZone(hit)), `swipe from card ${pos}`).toBe(false);
          }
          for (const mini of l.regions.strip.hands) {
            expect(overlaps(chip, mini), `mini hand ${mini.playerId}`).toBe(false);
          }
        });
      }
    }
  }
});
