import { describe, expect, it } from 'vitest';
import { legalActions } from './legal.js';
import type { CambioState } from './state.js';
import { act, attempt, card, drawAndDiscard, makeGame, pid } from './test-helpers.js';
import { getHostView } from './views.js';

const turnsOf = (s: CambioState) =>
  s.log.filter((e) => e.type === 'turnStarted').map((e) => (e as { playerId: string }).playerId);

describe('calling Cambio', () => {
  it('is not allowed until every player has taken a turn', () => {
    let s = makeGame({ count: 3, first: 1 });
    expect(legalActions(s, pid(1))).not.toContainEqual({ type: 'callCambio' });
    expect(attempt(s, pid(1), { type: 'callCambio' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_action' },
    });
    s = drawAndDiscard(s); // seat 1
    s = drawAndDiscard(s); // seat 2
    expect(attempt(s, pid(0), { type: 'callCambio' }).ok).toBe(false);
    s = drawAndDiscard(s); // seat 0: now everyone has played
    expect(getHostView(s).turn!.canCall).toBe(true);
    expect(legalActions(s, pid(1))).toContainEqual({ type: 'callCambio' });
    act(s, pid(1), { type: 'callCambio' });
  });

  it('only happens at the start of your turn, instead of drawing', () => {
    const s = act(makeGame({ played: true }), pid(0), { type: 'draw' });
    expect(attempt(s, pid(0), { type: 'callCambio' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
    expect(attempt(makeGame({ played: true }), pid(1), { type: 'callCambio' })).toMatchObject({
      ok: false,
      error: { code: 'not_your_turn' },
    });
  });

  it('gives every other player exactly one more turn, then ends the round', () => {
    let s = makeGame({ count: 4, first: 1, played: true });
    const before = s.log.length;
    s = act(s, pid(1), { type: 'callCambio' });
    expect(s.callerId).toBe(pid(1));
    expect(s.log[before]).toEqual({ type: 'cambioCalled', playerId: pid(1) });
    expect(s.deck).toHaveLength(20);
    s = drawAndDiscard(s);
    s = drawAndDiscard(s);
    expect(s.phase).toBe('play');
    s = drawAndDiscard(s);
    expect(s.phase).toBe('over');
    expect(turnsOf(s)).toEqual([pid(2), pid(3), pid(0)]);
    expect(s.log.at(-2)!.type).toBe('roundRevealed');
    expect(s.rounds[0]!.callerId).toBe(pid(1));
  });

  it('can only be called once a round', () => {
    const s = act(makeGame({ played: true }), pid(0), { type: 'callCambio' });
    expect(attempt(s, pid(1), { type: 'callCambio' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_action' },
    });
    expect(legalActions(s, pid(1))).not.toContainEqual({ type: 'callCambio' });
  });

  it('shows the caller and the lock on the host view', () => {
    const on = act(makeGame({ played: true }), pid(0), { type: 'callCambio' });
    expect(getHostView(on)).toMatchObject({ callerId: pid(0), lockedPlayerId: pid(0) });
    const off = act(makeGame({ played: true, options: { lockCaller: false } }), pid(0), {
      type: 'callCambio',
    });
    expect(getHostView(off)).toMatchObject({ callerId: pid(0), lockedPlayerId: null });
  });

  it('works at a two-player table', () => {
    let s = act(makeGame({ count: 2, played: true }), pid(0), { type: 'callCambio' });
    s = drawAndDiscard(s);
    expect(s.phase).toBe('over');
    expect(card('2').rank).toBe('2');
  });
});
