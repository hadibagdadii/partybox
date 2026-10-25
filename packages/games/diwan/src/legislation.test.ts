import { describe, expect, it } from 'vitest';
import {
  act,
  attempt,
  elect,
  failElection,
  legislate,
  loyals,
  makeGame,
  rebels,
} from './test-helpers.js';
import { getHostView, getPlayerView } from './views.js';

describe('legislative session', () => {
  it('Ameer discards 1 of 3, Wazir enacts 1 of 2', () => {
    let s = elect(makeGame({ deck: ['loyal', 'rebel', 'rebel', 'loyal'] }), 'p1');
    expect(getPlayerView(s, 'p0').hand).toEqual(['loyal', 'rebel', 'rebel']);
    expect(getPlayerView(s, 'p1').hand).toBeNull();
    expect(JSON.stringify(getHostView(s))).not.toContain('hand');

    s = act(s, 'p0', { type: 'ameerDiscard', index: 1 });
    expect(s.phase).toBe('wazirEnact');
    expect(getPlayerView(s, 'p0').hand).toBeNull();
    expect(getPlayerView(s, 'p1').hand).toEqual(['loyal', 'rebel']);

    s = act(s, 'p1', { type: 'wazirEnact', index: 0 });
    expect(s.enacted).toEqual({ loyal: 1, rebel: 0 });
    expect(s.discard).toEqual(['rebel', 'rebel']);
    expect(s.log.at(-1)).toEqual({
      type: 'enacted',
      decree: 'loyal',
      ameerId: 'p0',
      wazirId: 'p1',
    });
    expect(s.phase).toBe('nominate');
    expect(s.ameerId).toBe('p1');
  });

  it('the Wazir cannot discard for the Ameer, nor the Ameer enact', () => {
    let s = elect(makeGame({ deck: loyals(5) }), 'p1');
    expect(attempt(s, 'p1', { type: 'ameerDiscard', index: 0 })).toMatchObject({
      ok: false,
      error: { code: 'not_your_turn' },
    });
    s = act(s, 'p0', { type: 'ameerDiscard', index: 0 });
    expect(attempt(s, 'p0', { type: 'wazirEnact', index: 0 })).toMatchObject({
      ok: false,
      error: { code: 'not_your_turn' },
    });
  });
});

describe('reshuffle', () => {
  it('shuffles the discard pile in when fewer than 3 cards remain for a session', () => {
    const s0 = makeGame({ deck: ['loyal', 'rebel'] });
    s0.discard = [...rebels(4), 'loyal'];
    const s = elect(s0, 'p1');
    expect(s.log.some((e) => e.type === 'reshuffled' && e.drawCount === 7)).toBe(true);
    expect(s.hand).toHaveLength(3);
    expect(s.draw).toHaveLength(4);
    expect(s.discard).toEqual([]);
  });

  it('does not reshuffle with exactly 3 cards left', () => {
    const s0 = makeGame({ deck: loyals(3) });
    s0.discard = rebels(5);
    const s = elect(s0, 'p1');
    expect(s.log.some((e) => e.type === 'reshuffled')).toBe(false);
    expect(s.draw).toEqual([]);
  });

  it('reshuffles before Read the Scrolls when needed', () => {
    const s0 = makeGame({ deck: [...rebels(3), 'loyal'], enacted: { rebel: 2 } });
    s0.discard = rebels(3);
    const s = legislate(elect(s0, 'p1'), 'rebel');
    expect(s.pendingPower).toBe('policyPeek');
    expect(s.log.some((e) => e.type === 'reshuffled')).toBe(true);
    // 1 left + 3 old discards + 2 from this session.
    expect(s.draw).toHaveLength(6);
    expect(getPlayerView(s, 'p0').peek).toEqual(s.draw.slice(0, 3));
  });

  it('a riot on an empty draw pile reshuffles first', () => {
    const s0 = makeGame({ deck: [], unrest: 2 });
    s0.discard = loyals(4);
    const s = failElection(s0, 'p1');
    expect(s.log.some((e) => e.type === 'reshuffled')).toBe(true);
    expect(s.enacted.loyal).toBe(1);
    expect(s.draw).toHaveLength(3);
  });
});

describe('joint veto', () => {
  it('is locked before 5 rebel decrees', () => {
    let s = makeGame({ deck: rebels(5), enacted: { rebel: 4 } });
    s = act(elect(s, 'p1'), 'p0', { type: 'ameerDiscard', index: 0 });
    expect(attempt(s, 'p1', { type: 'proposeVeto' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_action' },
    });
    expect(getHostView(s).vetoUnlocked).toBe(false);
  });

  function atVeto(unrest = 0) {
    let s = makeGame({ deck: rebels(5), enacted: { rebel: 5 }, unrest });
    s = act(elect(s, 'p1'), 'p0', { type: 'ameerDiscard', index: 0 });
    expect(getHostView(s).vetoUnlocked).toBe(true);
    return act(s, 'p1', { type: 'proposeVeto' });
  }

  it('only the Ameer answers, while the Wazir keeps the cards', () => {
    const s = atVeto();
    expect(s.phase).toBe('vetoPending');
    expect(s.log.at(-1)).toEqual({ type: 'vetoProposed', wazirId: 'p1' });
    expect(getPlayerView(s, 'p1').hand).toHaveLength(2);
    expect(attempt(s, 'p1', { type: 'answerVeto', accept: true })).toMatchObject({
      ok: false,
      error: { code: 'not_your_turn' },
    });
  });

  it('accepted: both cards discarded and unrest rises', () => {
    const before = atVeto();
    const s = act(before, 'p0', { type: 'answerVeto', accept: true });
    expect(s.discard).toHaveLength(before.discard.length + 2);
    expect(s.enacted.rebel).toBe(5);
    expect(s.unrest).toBe(1);
    expect(s.phase).toBe('nominate');
    expect(s.ameerId).toBe('p1');
  });

  it('refused: the Wazir must enact and cannot propose again', () => {
    let s = act(atVeto(), 'p0', { type: 'answerVeto', accept: false });
    expect(s.phase).toBe('wazirEnact');
    expect(s.log.at(-1)).toEqual({ type: 'vetoAnswered', ameerId: 'p0', accept: false });
    expect(attempt(s, 'p1', { type: 'proposeVeto' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_action' },
    });
    s = act(s, 'p1', { type: 'wazirEnact', index: 0 });
    expect(s.winner).toEqual({ team: 'rebel', reason: 'rebelDecrees' });
  });

  it('an accepted veto can trigger a riot', () => {
    const before = atVeto(2);
    before.draw = ['loyal', ...before.draw];
    const s = act(before, 'p0', { type: 'answerVeto', accept: true });
    expect(s.log.some((e) => e.type === 'riot' && e.decree === 'loyal')).toBe(true);
    expect(s.enacted.loyal).toBe(1);
    expect(s.unrest).toBe(0);
    expect(s.lastElected).toBeNull();
  });
});
