import { describe, expect, it } from 'vitest';
import { legalActions, waitingOn } from './legal.js';
import { act, elect, makeGame, rebels } from './test-helpers.js';
import { getPlayerView } from './views.js';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

describe('legalActions and waitingOn', () => {
  it('reveal: everyone who has not acknowledged', () => {
    const s = act(makeGame({ reveal: true }), 'p1', { type: 'acknowledge' });
    expect(waitingOn(s)).toEqual(['p0', 'p2', 'p3', 'p4']);
    expect(legalActions(s, 'p0')).toEqual([{ type: 'acknowledge' }]);
    expect(legalActions(s, 'p1')).toEqual([]);
  });

  it('nominate: only the Ameer, one action per eligible Wazir', () => {
    const s = makeGame();
    expect(waitingOn(s)).toEqual(['p0']);
    expect(legalActions(s, 'p0').map((a) => a.type === 'nominate' && a.targetId)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
    ]);
    for (const id of ['p1', 'p2', 'p3', 'p4']) expect(legalActions(s, id)).toEqual([]);
  });

  it('vote: waits on living players who have not voted; anyone living may vote', () => {
    let s = act(makeGame(), 'p0', { type: 'nominate', targetId: 'p1' });
    s = act(s, 'p2', { type: 'vote', vote: 'no' });
    expect(waitingOn(s)).toEqual(['p0', 'p1', 'p3', 'p4']);
    expect(legalActions(s, 'p2')).toHaveLength(2);
    s.players[4]!.alive = false;
    expect(legalActions(s, 'p4')).toEqual([]);
    expect(waitingOn(s)).not.toContain('p4');
  });

  it('legislation: Ameer discards, then Wazir enacts', () => {
    const s = elect(makeGame({ deck: rebels(5) }), 'p1');
    expect(waitingOn(s)).toEqual(['p0']);
    expect(legalActions(s, 'p0')).toHaveLength(3);
    const w = act(s, 'p0', { type: 'ameerDiscard', index: 0 });
    expect(waitingOn(w)).toEqual(['p1']);
    expect(legalActions(w, 'p1')).toEqual([
      { type: 'wazirEnact', index: 0 },
      { type: 'wazirEnact', index: 1 },
    ]);
  });

  it('offers the veto once unlocked, then waits on the Ameer to answer', () => {
    const s = act(elect(makeGame({ deck: rebels(5), enacted: { rebel: 5 } }), 'p1'), 'p0', {
      type: 'ameerDiscard',
      index: 0,
    });
    expect(legalActions(s, 'p1')).toContainEqual({ type: 'proposeVeto' });
    const v = act(s, 'p1', { type: 'proposeVeto' });
    expect(waitingOn(v)).toEqual(['p0']);
    expect(legalActions(v, 'p0')).toHaveLength(2);
  });

  it('every waited-on player can act in a fresh game, and the phone gets its actions', () => {
    const s = makeGame({ count: 7, reveal: true });
    expect(waitingOn(s)).toEqual(ids(7));
    for (const id of ids(7)) {
      expect(getPlayerView(s, id).legalActions).toEqual([{ type: 'acknowledge' }]);
    }
    expect(getPlayerView(s, 'stranger').legalActions).toEqual([]);
  });

  it('over: nobody', () => {
    const s = makeGame();
    s.phase = 'over';
    expect(waitingOn(s)).toEqual([]);
    expect(legalActions(s, 'p0')).toEqual([]);
  });
});
