import { describe, expect, it } from 'vitest';
import { waitingOn } from './legal.js';
import { act, attempt, makeGame, pid } from './test-helpers.js';
import { getHostView } from './views.js';

const revealGame = () => makeGame({ count: 5, reveal: true });

function ackAll(seats: number[], from = revealGame()) {
  return seats.reduce((s, seat) => act(s, pid(seat), { type: 'acknowledge' }), from);
}

describe('role reveal', () => {
  it('rejects every other action until everyone has seen their role', () => {
    const s = ackAll([1, 2, 3, 4]);
    expect(attempt(s, 'p0', { type: 'nominate', targetId: 'p1' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
    expect(attempt(s, 'p2', { type: 'vote', vote: 'yes' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });

  it('rejects a second acknowledgement from the same player', () => {
    const s = ackAll([2]);
    expect(attempt(s, 'p2', { type: 'acknowledge' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_action' },
    });
  });

  it('rejects acknowledgements from strangers and after the reveal', () => {
    expect(attempt(revealGame(), 'stranger', { type: 'acknowledge' })).toMatchObject({
      ok: false,
      error: { code: 'not_your_turn' },
    });
    expect(attempt(makeGame(), 'p0', { type: 'acknowledge' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });

  it('starts the first nomination once the last player acknowledges', () => {
    const almost = ackAll([0, 1, 2, 3]);
    expect(almost.phase).toBe('reveal');
    const s = act(almost, 'p4', { type: 'acknowledge' });
    expect(s.phase).toBe('nominate');
    expect(s.ameerId).toBe('p0');
    expect(act(s, 'p0', { type: 'nominate', targetId: 'p1' }).phase).toBe('vote');
  });

  it('shows the host who has acknowledged, and waits on the rest', () => {
    const s = ackAll([3, 1]);
    expect(getHostView(s).acknowledgedIds).toEqual(['p3', 'p1']);
    expect(waitingOn(s)).toEqual(['p0', 'p2', 'p4']);
    expect(getHostView(s).waitingOn).toEqual(['p0', 'p2', 'p4']);
    expect(getHostView(ackAll([0, 1, 2, 3, 4])).acknowledgedIds).toEqual([]);
  });
});
