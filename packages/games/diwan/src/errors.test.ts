import { describe, expect, it } from 'vitest';
import { actionSchema } from './actions.js';
import { act, attempt, elect, makeGame, rebels } from './test-helpers.js';

describe('typed errors', () => {
  it('unseated players: not_your_turn', () => {
    expect(attempt(makeGame(), 'stranger', { type: 'nominate', targetId: 'p1' })).toMatchObject({
      ok: false,
      error: { code: 'not_your_turn' },
    });
  });

  it('a non-Ameer nominating: not_your_turn', () => {
    expect(attempt(makeGame(), 'p2', { type: 'nominate', targetId: 'p1' })).toMatchObject({
      ok: false,
      error: { code: 'not_your_turn' },
    });
  });

  it('voting during nomination: wrong_phase', () => {
    expect(attempt(makeGame(), 'p2', { type: 'vote', vote: 'yes' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });

  it('legislating during the vote: wrong_phase', () => {
    const s = act(makeGame(), 'p0', { type: 'nominate', targetId: 'p1' });
    expect(attempt(s, 'p0', { type: 'ameerDiscard', index: 0 })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
    expect(attempt(s, 'p1', { type: 'wazirEnact', index: 0 })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });

  it('veto actions out of phase: wrong_phase', () => {
    const s = elect(makeGame({ deck: rebels(5), enacted: { rebel: 5 } }), 'p1');
    expect(attempt(s, 'p1', { type: 'proposeVeto' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
    expect(attempt(s, 'p0', { type: 'answerVeto', accept: true })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });

  it('powers with none pending: wrong_phase', () => {
    expect(attempt(makeGame(), 'p0', { type: 'policyPeekDone' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });

  it('nominating an unknown player: invalid_action', () => {
    expect(attempt(makeGame(), 'p0', { type: 'nominate', targetId: 'nobody' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_action' },
    });
  });

  it('never mutates the input state', () => {
    const s = makeGame({ deck: rebels(5) });
    const snapshot = JSON.stringify(s);
    const next = elect(s, 'p1');
    act(next, 'p0', { type: 'ameerDiscard', index: 0 });
    attempt(s, 'p3', { type: 'nominate', targetId: 'p1' });
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

describe('actionSchema', () => {
  it('accepts well-formed actions', () => {
    expect(actionSchema.safeParse({ type: 'vote', vote: 'no' }).success).toBe(true);
    expect(actionSchema.safeParse({ type: 'execution', targetId: 'p2' }).success).toBe(true);
  });

  it.each([
    null,
    'vote',
    {},
    { type: 'dance' },
    { type: 'vote', vote: 'maybe' },
    { type: 'nominate' },
    { type: 'nominate', targetId: '' },
    { type: 'ameerDiscard', index: 3 },
    { type: 'ameerDiscard', index: 0.5 },
    { type: 'wazirEnact', index: 2 },
    { type: 'answerVeto', accept: 'yes' },
  ])('rejects %j', (payload) => {
    expect(actionSchema.safeParse(payload).success).toBe(false);
  });
});
