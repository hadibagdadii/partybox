import { describe, expect, it } from 'vitest';
import { diwanModule } from './index.js';
import type { DiwanState } from './state.js';
import { act, attempt, elect, loyals, makeGame, passDecree, rebels } from './test-helpers.js';
import { getHostView, getPlayerView } from './views.js';

function expectRevealed(s: DiwanState): void {
  const all = Object.fromEntries(s.players.map((p) => [p.id, p.role]));
  expect(getHostView(s).roles).toEqual(all);
  for (const p of s.players) expect(getPlayerView(s, p.id).knownRoles).toEqual(all);
}

describe('win conditions', () => {
  it('loyalists win at 5 loyal decrees', () => {
    const s = passDecree(makeGame({ deck: loyals(3), enacted: { loyal: 4 } }), 'p1', 'loyal');
    expect(s.winner).toEqual({ team: 'loyal', reason: 'loyalDecrees' });
    expect(s.log.at(-1)).toEqual({ type: 'gameOver', winner: 'loyal', reason: 'loyalDecrees' });
    expect(diwanModule.isOver(s)).toBe(true);
    expectRevealed(s);
  });

  it('rebels win at 6 rebel decrees, with no power granted', () => {
    const s = passDecree(makeGame({ deck: rebels(3), enacted: { rebel: 5 } }), 'p1', 'rebel');
    expect(s.winner).toEqual({ team: 'rebel', reason: 'rebelDecrees' });
    expect(s.pendingPower).toBeNull();
    expectRevealed(s);
  });

  it('rebels win when the Usurper is elected Wazir after 3 rebel decrees', () => {
    const s = elect(makeGame({ deck: rebels(5), enacted: { rebel: 3 } }), 'p4');
    expect(s.winner).toEqual({ team: 'rebel', reason: 'usurperElected' });
    expect(s.phase).toBe('over');
    expect(s.hand).toEqual([]);
    expectRevealed(s);
  });

  it('electing the Usurper with only 2 rebel decrees does not win', () => {
    const s = elect(makeGame({ deck: rebels(5), enacted: { rebel: 2 } }), 'p4');
    expect(s.winner).toBeNull();
    expect(s.phase).toBe('ameerDiscard');
  });

  it('a failed vote on the Usurper does not win', () => {
    let s = act(makeGame({ enacted: { rebel: 4 } }), 'p0', { type: 'nominate', targetId: 'p4' });
    for (const p of s.players) s = act(s, p.id, { type: 'vote', vote: 'no' });
    expect(s.winner).toBeNull();
  });

  it('loyalists win when the Usurper is exiled', () => {
    let s = passDecree(makeGame({ deck: rebels(5), enacted: { rebel: 3 } }), 'p1', 'rebel');
    expect(s.pendingPower).toBe('execution');
    s = act(s, 'p0', { type: 'execution', targetId: 'p4' });
    expect(s.winner).toEqual({ team: 'loyal', reason: 'usurperExiled' });
    expect(s.log.slice(-2)).toEqual([
      { type: 'exiled', targetId: 'p4' },
      { type: 'gameOver', winner: 'loyal', reason: 'usurperExiled' },
    ]);
    expectRevealed(s);
  });

  it('rejects every action after game over', () => {
    const s = passDecree(makeGame({ deck: loyals(3), enacted: { loyal: 4 } }), 'p1', 'loyal');
    expect(attempt(s, 'p1', { type: 'nominate', targetId: 'p2' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
    expect(attempt(s, 'p3', { type: 'vote', vote: 'yes' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });
});
