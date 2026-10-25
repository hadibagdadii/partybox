import { describe, expect, it } from 'vitest';
import { eligibleWazirIds } from './reduce.js';
import {
  act,
  attempt,
  elect,
  failElection,
  lastLog,
  legislate,
  loyals,
  makeGame,
  passDecree,
  pid,
  rebels,
  voteAll,
} from './test-helpers.js';
import { getHostView, getPlayerView } from './views.js';

describe('nomination', () => {
  it('moves to the vote and logs the nomination', () => {
    const s = act(makeGame(), 'p0', { type: 'nominate', targetId: 'p2' });
    expect(s.phase).toBe('vote');
    expect(s.nomineeId).toBe('p2');
    expect(lastLog(s)).toEqual({ type: 'nominated', ameerId: 'p0', wazirId: 'p2' });
  });

  it('the Ameer cannot nominate themself', () => {
    const r = attempt(makeGame(), 'p0', { type: 'nominate', targetId: 'p0' });
    expect(r).toMatchObject({ ok: false, error: { code: 'invalid_action' } });
  });
});

describe('term limits', () => {
  it('bars the last Ameer and Wazir with more than 5 alive', () => {
    let s = makeGame({ count: 7, deck: loyals(10) });
    s = passDecree(s, 'p3', 'loyal'); // p0 Ameer, p3 Wazir
    expect(s.ameerId).toBe('p1');
    expect(eligibleWazirIds(s).sort()).toEqual(['p2', 'p4', 'p5', 'p6']);
    for (const banned of ['p0', 'p3']) {
      expect(attempt(s, 'p1', { type: 'nominate', targetId: banned })).toMatchObject({
        ok: false,
        error: { code: 'invalid_action' },
      });
    }
  });

  it('bars only the last Wazir with 5 players', () => {
    let s = makeGame({ count: 5, deck: loyals(10) });
    s = passDecree(s, 'p3', 'loyal');
    expect(eligibleWazirIds(s).sort()).toEqual(['p0', 'p2', 'p4']);
  });

  it('bars only the last Wazir once only 5 remain alive', () => {
    let s = makeGame({ count: 7, deck: loyals(10) });
    s.players[5]!.alive = false;
    s.players[6]!.alive = false;
    s = passDecree(s, 'p3', 'loyal');
    expect(eligibleWazirIds(s).sort()).toEqual(['p0', 'p2', 'p4']);
  });

  it('a failed government sets no term limits', () => {
    let s = makeGame({ count: 7 });
    s = failElection(s, 'p3');
    expect(s.lastElected).toBeNull();
    expect(eligibleWazirIds(s)).toContain('p3');
  });
});

describe('voting', () => {
  it('passes on a strict majority', () => {
    let s = act(makeGame(), 'p0', { type: 'nominate', targetId: 'p1' });
    s = voteAll(s, 'yes', { p3: 'no', p4: 'no' });
    expect(s.phase).toBe('ameerDiscard');
    expect(s.lastElected).toEqual({ ameerId: 'p0', wazirId: 'p1' });
  });

  it('fails on a tie', () => {
    let s = act(makeGame({ count: 6 }), 'p0', { type: 'nominate', targetId: 'p1' });
    s = voteAll(s, 'yes', { p3: 'no', p4: 'no', p5: 'no' });
    expect(s.log.at(-2)).toMatchObject({ type: 'votesRevealed', passed: false });
    expect(s.unrest).toBe(1);
    expect(s.phase).toBe('nominate');
    expect(s.ameerId).toBe('p1');
  });

  it('keeps votes hidden until everyone has voted, then reveals them all', () => {
    let s = act(makeGame(), 'p0', { type: 'nominate', targetId: 'p1' });
    for (const id of ['p0', 'p1', 'p2', 'p3']) s = act(s, id, { type: 'vote', vote: 'yes' });
    const host = getHostView(s);
    expect(host.votedIds).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(JSON.stringify(host)).not.toContain('"yes"');
    expect(getPlayerView(s, 'p2').myVote).toBe('yes');
    expect(getPlayerView(s, 'p4').myVote).toBeNull();
    expect(s.log.some((e) => e.type === 'votesRevealed')).toBe(false);

    s = act(s, 'p4', { type: 'vote', vote: 'no' });
    expect(s.log.find((e) => e.type === 'votesRevealed')).toEqual({
      type: 'votesRevealed',
      votes: { p0: 'yes', p1: 'yes', p2: 'yes', p3: 'yes', p4: 'no' },
      passed: true,
    });
  });

  it('lets a player change their vote before the reveal', () => {
    let s = act(makeGame(), 'p0', { type: 'nominate', targetId: 'p1' });
    s = act(s, 'p0', { type: 'vote', vote: 'yes' });
    const changed = attempt(s, 'p0', { type: 'vote', vote: 'no' });
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    s = changed.state;
    expect(getHostView(s).votedIds).toEqual(['p0']);
    expect(getPlayerView(s, 'p0').myVote).toBe('no');

    s = act(s, 'p1', { type: 'vote', vote: 'yes' });
    s = act(s, 'p2', { type: 'vote', vote: 'no' });
    s = act(s, 'p3', { type: 'vote', vote: 'yes' });
    s = act(s, 'p4', { type: 'vote', vote: 'no' });
    expect(s.log.find((e) => e.type === 'votesRevealed')).toMatchObject({
      votes: { p0: 'no' },
      passed: false,
    });
  });

  it('locks votes after the reveal', () => {
    let s = act(makeGame(), 'p0', { type: 'nominate', targetId: 'p1' });
    s = voteAll(s, 'yes');
    expect(attempt(s, 'p2', { type: 'vote', vote: 'no' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });
});

describe('exiled players', () => {
  it('are excluded from votes, nominations, and the Ameer rotation', () => {
    let s = makeGame({ count: 7 });
    s.players[1]!.alive = false;
    s.players[2]!.alive = false;
    expect(eligibleWazirIds(s)).not.toContain('p1');
    expect(attempt(s, 'p0', { type: 'nominate', targetId: 'p1' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_action' },
    });

    s = act(s, 'p0', { type: 'nominate', targetId: 'p3' });
    expect(attempt(s, 'p1', { type: 'vote', vote: 'yes' })).toMatchObject({
      ok: false,
      error: { code: 'not_your_turn' },
    });
    // Five living votes complete the vote.
    for (const id of ['p0', 'p3', 'p4', 'p5', 'p6']) s = act(s, id, { type: 'vote', vote: 'no' });
    expect(s.phase).toBe('nominate');
    expect(s.ameerId).toBe('p3');
  });

  it('rotation wraps past the last seat', () => {
    let s = makeGame({ count: 5, ameerSeat: 4 });
    s.players[0]!.alive = false;
    s = failElection(s, 'p1');
    expect(s.ameerId).toBe('p1');
  });
});

describe('unrest and riots', () => {
  it('each failed vote adds unrest', () => {
    let s = makeGame();
    s = failElection(s, 'p2');
    expect(s.unrest).toBe(1);
    expect(lastLog(s)).toEqual({ type: 'unrest', level: 1 });
    s = failElection(s, 'p3');
    expect(s.unrest).toBe(2);
  });

  it('a third failure riots: top decree, no power, reset unrest, clear term limits', () => {
    // 7 players with 1 rebel decree: a government's rebel decree would grant Send a Spy.
    let s = makeGame({ count: 7, deck: [...loyals(3), ...rebels(10)], enacted: { rebel: 0 } });
    s = passDecree(s, 'p3', 'loyal'); // p0 / p3 elected, term-limited
    s.enacted.rebel = 1;
    s.draw = rebels(10);
    s = failElection(s, 'p4');
    s = failElection(s, 'p4');
    s = failElection(s, 'p5');
    expect(s.enacted.rebel).toBe(2);
    expect(s.log.some((e) => e.type === 'riot' && e.decree === 'rebel')).toBe(true);
    expect(s.unrest).toBe(0);
    expect(s.phase).toBe('nominate');
    expect(s.pendingPower).toBeNull();
    expect(s.lastElected).toBeNull();
    expect(eligibleWazirIds(s)).toEqual(expect.arrayContaining(['p0', 'p3']));
    expect(s.draw).toHaveLength(9);
  });

  it('a government enacting a decree resets unrest', () => {
    let s = makeGame({ deck: loyals(10), unrest: 2 });
    s = elect(s, 'p1');
    expect(s.unrest).toBe(2);
    s = legislate(s, 'loyal');
    expect(s.unrest).toBe(0);
  });

  it('a riot can win the game', () => {
    let s = makeGame({ deck: loyals(5), enacted: { loyal: 4 }, unrest: 2 });
    s = failElection(s, 'p1');
    expect(s.winner).toEqual({ team: 'loyal', reason: 'loyalDecrees' });
    expect(s.phase).toBe('over');
  });

  it('the Ameer passes to the next seat after a riot', () => {
    let s = makeGame({ deck: loyals(5), unrest: 2 });
    s = failElection(s, pid(1));
    expect(s.ameerId).toBe('p1');
  });
});
