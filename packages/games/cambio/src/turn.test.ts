import { describe, expect, it } from 'vitest';
import { actionSchema } from './actions.js';
import { act, actE, attempt, card, facesIn, makeGame, pid, slot, top } from './test-helpers.js';
import { getHostView, getPlayerView } from './views.js';

const hands = [
  [card('A'), card('2'), card('3'), card('4')],
  [card('5'), card('6'), card('7'), card('8')],
  [card('9'), card('10'), card('J'), card('Q')],
];

describe('drawing', () => {
  it('shows the drawn card only to the player who drew it', () => {
    const s0 = makeGame({ hands, deck: [card('6', 'hearts'), card('2')] });
    const drawnId = s0.deck[0]!.id;
    const { s, events } = actE(s0, pid(0), { type: 'draw' });
    expect(events).toEqual([{ type: 'drew', playerId: pid(0), cardId: drawnId }]);
    expect(s.deck).toHaveLength(1);
    expect(getPlayerView(s, pid(0)).drawn).toEqual({
      cardId: drawnId,
      face: card('6', 'hearts'),
    });
    expect(getPlayerView(s, pid(1)).drawn).toBeNull();
    const host = getHostView(s);
    expect(host.turn).toMatchObject({ playerId: pid(0), stage: 'drawn', drawnCardId: drawnId });
    expect(facesIn(host).map((f) => f.cardId)).not.toContain(drawnId);
  });

  it('only lets the current player draw, once, at the start of the turn', () => {
    const s = makeGame({ hands });
    expect(attempt(s, pid(1), { type: 'draw' })).toMatchObject({
      ok: false,
      error: { code: 'not_your_turn' },
    });
    const drawn = act(s, pid(0), { type: 'draw' });
    expect(attempt(drawn, pid(0), { type: 'draw' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });

  it('has no way to take from the discard pile', () => {
    expect(actionSchema.safeParse({ type: 'takeDiscard' }).success).toBe(false);
    expect(actionSchema.safeParse({ type: 'draw', from: 'discard' }).data).toEqual({
      type: 'draw',
    });
  });

  it('needs a draw before swapping or discarding', () => {
    const s = makeGame({ hands });
    expect(attempt(s, pid(0), { type: 'discard' }).ok).toBe(false);
    expect(attempt(s, pid(0), { type: 'swap', slotId: slot(s, 0, 0).id }).ok).toBe(false);
  });
});

describe('swap', () => {
  it('puts the drawn card face down and discards the replaced card face up', () => {
    const s0 = act(makeGame({ hands, deck: [card('K', 'hearts')] }), pid(0), { type: 'draw' });
    const drawn = s0.turn!.drawn!;
    const target = slot(s0, 0, 1);
    const { s, events } = actE(s0, pid(0), { type: 'swap', slotId: target.id });
    expect(slot(s, 0, 1)).toEqual({ id: target.id, card: drawn });
    expect(top(s)).toEqual(card('2'));
    expect(events[0]).toEqual({
      type: 'swapped',
      playerId: pid(0),
      slotId: target.id,
      cardId: drawn.id,
      discarded: { cardId: target.card.id, face: card('2') },
    });
    expect(getHostView(s).topDiscard).toEqual({ cardId: target.card.id, face: card('2') });
    expect(s.turn).toMatchObject({ playerId: pid(1), stage: 'start' });
    expect(events[1]).toEqual({ type: 'turnStarted', playerId: pid(1) });
  });

  it('never triggers the power of the replaced card', () => {
    // Player 1 replaces their 7 (a peek card) with the drawn card.
    let s = makeGame({ hands, first: 1 });
    s = act(s, pid(1), { type: 'draw' });
    s = act(s, pid(1), { type: 'swap', slotId: slot(s, 1, 2).id });
    expect(top(s).rank).toBe('7');
    expect(s.turn).toMatchObject({ playerId: pid(2), stage: 'start', power: null });
  });

  it('only swaps into your own hand', () => {
    const s = act(makeGame({ hands }), pid(0), { type: 'draw' });
    expect(attempt(s, pid(0), { type: 'swap', slotId: slot(s, 1, 0).id })).toMatchObject({
      ok: false,
      error: { code: 'invalid_action' },
    });
    expect(attempt(s, pid(0), { type: 'swap', slotId: 'nope' }).ok).toBe(false);
  });
});

describe('discard', () => {
  it('discards the drawn card face up; a card without a power ends the turn', () => {
    const s0 = act(makeGame({ hands, deck: [card('5', 'diamonds')] }), pid(0), { type: 'draw' });
    const drawnId = s0.turn!.drawn!.id;
    const { s, events } = actE(s0, pid(0), { type: 'discard' });
    expect(events[0]).toEqual({
      type: 'discardedDrawn',
      playerId: pid(0),
      card: { cardId: drawnId, face: card('5', 'diamonds') },
    });
    expect(top(s)).toEqual(card('5', 'diamonds'));
    expect(s.turn).toMatchObject({ playerId: pid(1), stage: 'start', drawn: null });
  });

  it('passes play clockwise and wraps around', () => {
    let s = makeGame({ hands, first: 2 });
    s = act(act(s, pid(2), { type: 'draw' }), pid(2), { type: 'discard' });
    expect(s.turn!.playerId).toBe(pid(0));
  });

  it('opens the power of a drawn power card', () => {
    const s = act(act(makeGame({ hands, deck: [card('8')] }), pid(0), { type: 'draw' }), pid(0), {
      type: 'discard',
    });
    expect(s.turn).toMatchObject({ playerId: pid(0), stage: 'power', power: 'peekOwn' });
  });
});
