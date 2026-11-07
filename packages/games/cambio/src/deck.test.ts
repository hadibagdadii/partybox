import { describe, expect, it } from 'vitest';
import { cardCount } from './rules.js';
import { actE, card, makeGame, pid, snapAt } from './test-helpers.js';

describe('when the deck runs out', () => {
  it('shuffles the discard pile except its top card into a new deck with new ids', () => {
    const s0 = makeGame({ deck: [], discard: [card('3'), card('4'), card('6'), card('9')] });
    const oldIds = s0.discard.map((c) => c.id);
    const topCard = s0.discard[3]!;
    const total = cardCount(s0);
    const { s, events } = actE(s0, pid(0), { type: 'draw' });
    expect(events.map((e) => e.type)).toEqual(['reshuffled', 'drew']);
    expect(events[0]).toEqual({ type: 'reshuffled', deckCount: 3 });
    expect(s.discard).toEqual([topCard]);
    expect(s.deck).toHaveLength(2);
    const reshuffled = [...s.deck, s.turn!.drawn!];
    expect(reshuffled.map((c) => c.face.rank).sort()).toEqual(['3', '4', '6']);
    for (const c of reshuffled) expect(oldIds).not.toContain(c.id);
    expect(cardCount(s)).toBe(total);
  });

  it('reshuffles for a penalty card too', () => {
    const s0 = makeGame({ deck: [], discard: [card('3'), card('4'), card('5')] });
    const { s, events } = actE(s0, pid(1), snapAt(s0, 1, 0));
    expect(events.map((e) => e.type)).toEqual(['reshuffled', 'snapFailed']);
    expect(s.players[1]!.hand).toHaveLength(5);
  });

  it('skips the penalty when no card is left anywhere', () => {
    const s0 = makeGame({ deck: [], discard: [card('5')] });
    const { s, events } = actE(s0, pid(1), snapAt(s0, 1, 0));
    expect(events[0]).toMatchObject({ type: 'snapFailed', penalty: null });
    expect(s.players[1]!.hand).toHaveLength(4);
  });

  it('ends the round when there is nothing left to draw', () => {
    const s0 = makeGame({ deck: [], discard: [card('5')] });
    const { s, events } = actE(s0, pid(0), { type: 'draw' });
    expect(events.map((e) => e.type)).toEqual(['roundRevealed', 'gameOver']);
    expect(s.phase).toBe('over');
  });
});
