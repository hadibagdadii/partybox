import { createRng } from '@partybox/shared';
import { describe, expect, it } from 'vitest';
import { actionSchema } from './actions.js';
import { legalActions, waitingOn } from './legal.js';
import { reduce } from './reduce.js';
import type { CambioState } from './state.js';
import { attempt, callAndFinish, makeGame, pid } from './test-helpers.js';

describe('typed errors', () => {
  it('rejects players who are not seated', () => {
    expect(attempt(makeGame(), 'stranger', { type: 'draw' })).toMatchObject({
      ok: false,
      error: { code: 'not_your_turn' },
    });
  });

  it('rejects everything once the game is over', () => {
    const over = callAndFinish(makeGame({ played: true }));
    expect(attempt(over, pid(1), { type: 'draw' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
    expect(legalActions(over, pid(1))).toEqual([]);
    expect(waitingOn(over)).toEqual([]);
  });

  it('rejects malformed payloads at the schema', () => {
    for (const bad of [
      null,
      {},
      { type: 'snap' },
      { type: 'snap', slotId: 's1' },
      { type: 'blindSwap', slotIds: ['s1'] },
      { type: 'swap', slotId: '' },
      { type: 'peek', slotId: 'x'.repeat(65) },
    ]) {
      expect(actionSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('never throws and never changes the input state', () => {
    const picker = createRng(4);
    const types = [
      'ready',
      'continue',
      'draw',
      'callCambio',
      'swap',
      'discard',
      'peek',
      'donePeek',
      'blindSwap',
      'kingSwap',
      'skipPower',
      'snap',
    ] as const;
    for (let i = 0; i < 400; i++) {
      const s: CambioState = makeGame({ peek: i % 3 === 0, played: i % 2 === 0 });
      const before = JSON.stringify(s);
      const ids = ['s1', 's2', 's5', 'nope', 'c1', s.players[1]!.hand[0]!.card.id];
      const id = () => ids[picker.int(ids.length)]!;
      const action = actionSchema.parse({
        type: types[picker.int(types.length)],
        slotId: id(),
        cardId: id(),
        slotIds: [id(), id()],
        ...(picker.int(2) ? { giveSlotId: id() } : {}),
      });
      expect(() => reduce(s, { playerId: pid(picker.int(4)), action }, createRng(i))).not.toThrow();
      expect(JSON.stringify(s)).toBe(before);
    }
  });
});
