import { createRng } from '@partybox/shared';
import { describe, expect, it } from 'vitest';
import { cambioModule as game } from './index.js';
import { legalActions, waitingOn } from './legal.js';
import type { CambioState } from './state.js';
import { attempt, card, makeGame, pid, slot } from './test-helpers.js';

/** Every action legalActions lists for every player succeeds. */
function allLegalSucceed(s: CambioState): void {
  for (const p of s.players) {
    for (const action of legalActions(s, p.id)) {
      const result = attempt(s, p.id, action);
      expect(result.ok, `${p.id} ${JSON.stringify(action)}`).toBe(true);
    }
  }
}

describe('legalActions', () => {
  it('lists only actions the reducer accepts, across a few seeded games', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const rng = createRng(seed);
      const seats = Array.from({ length: 3 }, (_, i) => ({ id: pid(i), name: `P${i}` }));
      const options = game.optionsSchema!.parse({ scoringMode: 'match', matchTarget: 10 });
      let s = game.createInitialState(seats, rng, options);
      for (let step = 0; step < 40 && !game.isOver(s); step++) {
        allLegalSucceed(s);
        for (const id of waitingOn(s)) expect(legalActions(s, id).length).toBeGreaterThan(0);
        const turnPlayer = waitingOn(s)[0]!;
        const moves = legalActions(s, turnPlayer).filter((a) => a.type !== 'snap');
        const move = moves[rng.int(moves.length)]!;
        const result = game.reduce(s, { playerId: turnPlayer, action: move }, rng);
        if (!result.ok) throw new Error(result.error.message);
        s = result.state;
      }
    }
  });

  it('offers draw at the start, swap or discard after drawing', () => {
    const s = makeGame({ hands: [[card('A'), card('2')]] });
    expect(legalActions(s, pid(0)).filter((a) => a.type !== 'snap')).toEqual([{ type: 'draw' }]);
    expect(legalActions(s, pid(1)).every((a) => a.type === 'snap')).toBe(true);
    const drawn = attempt(s, pid(0), { type: 'draw' });
    if (!drawn.ok) throw new Error('draw failed');
    expect(legalActions(drawn.state, pid(0)).filter((a) => a.type !== 'snap')).toEqual([
      { type: 'swap', slotId: slot(drawn.state, 0, 0).id },
      { type: 'swap', slotId: slot(drawn.state, 0, 1).id },
      { type: 'discard' },
    ]);
  });

  it('lists a snap with a give slot for each of your cards', () => {
    const s = makeGame({ count: 2, hands: [[card('A'), card('2')], [card('3')]] });
    const snaps = legalActions(s, pid(0)).filter((a) => a.type === 'snap');
    // Two of your own, plus their one card times your two give slots.
    expect(snaps).toHaveLength(4);
  });

  it('waits on anyone between rounds', () => {
    let s = makeGame({ played: true, options: { scoringMode: 'match' } });
    s = { ...s, phase: 'roundOver', turn: null };
    expect(waitingOn(s)).toEqual([pid(0), pid(1), pid(2)]);
    for (const p of s.players) expect(legalActions(s, p.id)).toEqual([{ type: 'continue' }]);
  });
});
