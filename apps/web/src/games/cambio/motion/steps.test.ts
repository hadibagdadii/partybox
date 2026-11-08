import { cambioModule, type CambioState } from '@partybox/cambio';
import { FIXTURE_IDS, buildFixture } from '@partybox/cambio/fixtures';
import { createRng } from '@partybox/shared';
import { describe, expect, it } from 'vitest';
import { CARD_RATIO } from '../tokens';
import { handCols, phoneLayout, posesFor, tableLayout } from './layout';
import { sceneFromView, sceneKey } from './scene';
import { applyEvent, dealStagger, stepsFor } from './steps';

const host = (s: CambioState) => cambioModule.getHostView(s);

describe('the scene follows the real engine', () => {
  describe.each([6, 12])('%i-player fixtures', (count) => {
    it.each(FIXTURE_IDS)('%s ends on the true state after every broadcast', (id) => {
      const f = buildFixture(id, count);
      let scene = sceneFromView(f.before.host);
      for (const step of f.steps) {
        scene = stepsFor(scene, step.events).scene;
        expect(sceneKey(scene)).toEqual(sceneKey(sceneFromView(step.host)));
      }
    });
  });

  it.each([2, 5, 9, 12])('tracks random full games with snaps on a %i-player table', (count) => {
    const rng = createRng(count * 7919);
    const seats = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
    const seen = new Set<string>();
    for (let game = 0; game < 4; game++) {
      let s = cambioModule.createInitialState(seats, rng, {
        scoringMode: game % 2 ? 'match' : 'single',
        matchTarget: 60,
        lockCaller: game % 3 === 0,
        rememberPeeks: false,
      });
      let scene = sceneFromView(host(s));
      for (let i = 0; i < 600 && !cambioModule.isOver(s); i++) {
        const choices = seats.flatMap((p) =>
          cambioModule.legalActions!(s, p.id).map((action) => ({ playerId: p.id, action })),
        );
        // Snaps are offered constantly; take them now and then so turns move on too.
        const snaps = choices.filter((c) => c.action.type === 'snap');
        const turns = choices.filter((c) => c.action.type !== 'snap');
        const pool = snaps.length && (rng.int(5) === 0 || !turns.length) ? snaps : turns;
        const pick = pool[rng.int(pool.length)]!;
        const r = cambioModule.reduce(s, pick, rng);
        if (!r.ok) throw new Error(r.error.message);
        s = r.state;
        for (const e of r.events) seen.add(e.type);
        scene = stepsFor(scene, r.events).scene;
        expect(sceneKey(scene)).toEqual(sceneKey(sceneFromView(host(s))));
      }
    }
    for (const type of ['snapped', 'snapFailed', 'swapped', 'roundRevealed']) {
      expect(seen).toContain(type);
    }
  });
});

describe('steps', () => {
  it('deal sends one card to each seat in turn, then flips the first discard', () => {
    const f = buildFixture('deal', 6);
    const dealt = f.steps[0]!.events[0]!;
    const { step } = applyEvent(sceneFromView(f.before.host), dealt);
    if (dealt.type !== 'dealt') throw new Error('expected dealt');
    const firstPass = dealt.hands.map((h) => h.slots[0]!.cardId);
    expect(step.moves.slice(0, 6).map((m) => m.cardId)).toEqual(firstPass);
    expect(step.moves.every((m) => m.fromDeck)).toBe(true);
    expect(step.moves.at(-1)!.cardId).toBe(dealt.discard.cardId);
    const delays = step.moves.map((m) => m.delay);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(step.long).toBe(true);
  });

  it('deal stagger shrinks on big tables but never passes 60 ms', () => {
    expect(dealStagger(25)).toBe(56);
    expect(dealStagger(10)).toBe(60);
    expect(dealStagger(49)).toBeLessThan(30);
  });

  it('a snap with a give keeps the snapped slot id and removes the give slot', () => {
    const f = buildFixture('snapGive', 6);
    const before = sceneFromView(f.before.host);
    const e = f.steps[0]!.events[0]!;
    if (e.type !== 'snapped' || !e.give) throw new Error('expected a give');
    const { scene, step } = applyEvent(before, e);
    const owner = scene.seats.find((x) => x.playerId === e.ownerId)!;
    expect(owner.slots.find((x) => x.slotId === e.slotId)?.cardId).toBe(e.give.cardId);
    const snapper = scene.seats.find((x) => x.playerId === e.snapperId)!;
    expect(snapper.slots.some((x) => x.slotId === e.give!.slotId)).toBe(false);
    expect(step.kind).toBe('snapGive');
    expect(step.moves.map((m) => m.path)).toEqual(['slam', 'spring']);
    expect(step.effects.map((x) => x.kind)).toEqual(['impact', 'pileShake']);
  });

  it('a wrong snap flips up, shakes, flips back, then a penalty flies from the deck', () => {
    const f = buildFixture('wrongSnap', 6);
    const e = f.steps[0]!.events[0]!;
    if (e.type !== 'snapFailed' || !e.penalty) throw new Error('expected a penalty');
    const { scene, step } = applyEvent(sceneFromView(f.before.host), e);
    expect(step.flips[0]).toMatchObject({ cardId: e.card.cardId, rotateY: [180, 0, 0, 180] });
    expect(step.effects[0]).toMatchObject({ kind: 'shake', cardId: e.card.cardId });
    expect(step.moves[0]).toMatchObject({ cardId: e.penalty.cardId, fromDeck: true });
    expect(step.moves[0]!.delay).toBeGreaterThan(step.flips[0]!.duration / 2);
    const snapper = scene.seats.find((x) => x.playerId === e.snapperId)!;
    expect(snapper.slots.at(-1)).toEqual(e.penalty);
  });

  it('a reshuffle sweeps the pile without tracking card ids across it', () => {
    const f = buildFixture('reshuffle', 6);
    const before = sceneFromView(f.before.host);
    const e = f.steps[0]!.events.find((x) => x.type === 'reshuffled')!;
    const { scene, step } = applyEvent(before, e);
    expect(step.moves).toEqual([]);
    expect(step.effects[0]).toMatchObject({ kind: 'sweep' });
    expect(scene.discard).toEqual(before.discard.slice(-1));
    expect(scene.discardCount).toBe(1);
  });

  it('a blind swap arcs both cards into each other’s slots', () => {
    const f = buildFixture('blindSwap', 6);
    const e = f.steps[0]!.events[0]!;
    if (e.type !== 'blindSwap') throw new Error('expected blindSwap');
    const { step } = applyEvent(sceneFromView(f.before.host), e);
    expect(step.moves.map((m) => [m.cardId, m.path])).toEqual([
      [e.a.cardId, 'arc'],
      [e.b.cardId, 'arc'],
    ]);
  });

  it('round reveal flips each seat in sequence', () => {
    const f = buildFixture('reveal', 6);
    const before = stepsFor(sceneFromView(f.before.host), []).scene;
    const e = f.steps[0]!.events.find((x) => x.type === 'roundRevealed')!;
    let scene = before;
    for (const x of f.steps[0]!.events) {
      if (x === e) break;
      scene = applyEvent(scene, x).scene;
    }
    const { step } = applyEvent(scene, e);
    const delays = [...new Set(step.flips.map((x) => x.delay))];
    expect(delays).toHaveLength(6);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(step.long).toBe(true);
  });
});

describe('stable grid positions', () => {
  const seat = (scene: ReturnType<typeof sceneFromView>, playerId: string) =>
    scene.seats.find((x) => x.playerId === playerId)!;

  it('a snap leaves a hole and every other card keeps its pose', () => {
    const f = buildFixture('holes', 6);
    const layout = tableLayout(
      1920,
      1080,
      f.before.host.players.map((p) => p.id),
    );
    const before = sceneFromView(f.before.host);
    const { scene } = applyEvent(before, f.steps[0]!.events[0]!);
    const owner = f.before.host.players[1]!.id;
    expect(seat(scene, owner).slots.map((x) => x.pos)).toEqual([1, 2, 3]);
    const a = posesFor(before, layout);
    const b = posesFor(scene, layout);
    for (const x of seat(scene, owner).slots) expect(b.get(x.cardId)).toEqual(a.get(x.cardId));
  });

  it('a penalty fills the hole before the grid grows, then extends it', () => {
    const f = buildFixture('holes', 6);
    let scene = sceneFromView(f.before.host);
    const owner = f.before.host.players[1]!.id;
    const positions: number[][] = [];
    for (const step of f.steps.slice(0, 3)) {
      scene = stepsFor(scene, step.events).scene;
      positions.push(seat(scene, owner).slots.map((x) => x.pos));
    }
    expect(positions).toEqual([
      [1, 2, 3],
      [0, 1, 2, 3],
      [0, 1, 2, 3, 4],
    ]);
  });

  it('the grid narrows only once its last column is empty', () => {
    expect(handCols([0, 1, 2, 3])).toBe(2);
    expect(handCols([1, 2, 3])).toBe(2);
    expect(handCols([0, 1, 2, 3, 4])).toBe(3);
    // A hole inside the grid keeps its column; the last column empty narrows it.
    expect(handCols([0, 2, 3, 5])).toBe(3);
    expect(handCols([0, 1, 2, 3, 6])).toBe(4);
    expect(handCols([])).toBe(2);
  });

  it('the phone keeps your hand fully inside its box at every width the grid reaches', () => {
    const ids = ['you', 'a', 'b', 'c', 'd', 'e'];
    const l = phoneLayout(375, 740, ids, 'you');
    for (let cols = 2; cols <= 6; cols++) {
      for (let pos = 0; pos < cols * 2; pos++) {
        const p = l.slot('you', pos, cols);
        const w = p.scale * l.spriteWidth;
        const h = w * CARD_RATIO;
        expect(p.x - w / 2).toBeGreaterThanOrEqual(0);
        expect(p.x + w / 2).toBeLessThanOrEqual(375);
        expect(p.y - h / 2).toBeGreaterThanOrEqual(l.regions.hand.top - 1);
        expect(p.y + h / 2).toBeLessThanOrEqual(l.regions.hand.bottom + 1);
      }
    }
  });
});

describe('the TV table keeps every hand on screen and apart', () => {
  type Box = { l: number; r: number; t: number; b: number };
  const boxOf = (layout: ReturnType<typeof tableLayout>, id: string, positions: number[]): Box => {
    const cols = handCols(positions);
    const boxes = positions.map((pos) => {
      const p = layout.slot(id, pos, cols);
      const w = p.scale * layout.spriteWidth;
      const h = w * CARD_RATIO;
      return { l: p.x - w / 2, r: p.x + w / 2, t: p.y - h / 2, b: p.y + h / 2 };
    });
    return {
      l: Math.min(...boxes.map((x) => x.l)),
      r: Math.max(...boxes.map((x) => x.r)),
      t: Math.min(...boxes.map((x) => x.t)),
      b: Math.max(...boxes.map((x) => x.b)),
    };
  };
  const overlap = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

  describe.each([
    [1920, 1080],
    [1280, 720],
  ])('%ix%i', (w, h) => {
    it.each([2, 4, 6, 8, 9, 10, 12])('%i seats, with 4 or 8 cards each', (n) => {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const layout = tableLayout(w, h, ids);
      for (const size of [4, 8]) {
        const positions = Array.from({ length: size }, (_, i) => i);
        const boxes = ids.map((id) => boxOf(layout, id, positions));
        for (const [i, b] of boxes.entries()) {
          expect(b.l, `seat ${i}`).toBeGreaterThanOrEqual(0);
          expect(b.r, `seat ${i}`).toBeLessThanOrEqual(w);
          expect(b.t, `seat ${i}`).toBeGreaterThanOrEqual(0);
          expect(b.b, `seat ${i}`).toBeLessThanOrEqual(h);
          for (let j = i + 1; j < boxes.length; j++) {
            expect(overlap(b, boxes[j]!), `seats ${i} and ${j}, ${size} cards`).toBe(false);
          }
        }
        for (const seat of layout.seats) {
          expect(seat.labelX).toBeGreaterThan(0);
          expect(seat.labelX).toBeLessThan(w);
          expect(seat.labelY).toBeGreaterThan(0);
          expect(seat.labelY).toBeLessThan(h);
        }
      }
    });
  });
});
