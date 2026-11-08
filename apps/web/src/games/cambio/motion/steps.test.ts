import { cambioModule, type CambioState } from '@partybox/cambio';
import { FIXTURE_IDS, buildFixture } from '@partybox/cambio/fixtures';
import { createRng } from '@partybox/shared';
import { describe, expect, it } from 'vitest';
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
