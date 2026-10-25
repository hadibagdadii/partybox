import { createRng } from '@partybox/shared';
import { describe, expect, it } from 'vitest';
import { tapRaceModule as game } from './index.js';

const rng = createRng(1);
const players = [
  { id: 'a', name: 'Amina' },
  { id: 'b', name: 'Bilal' },
];

describe('tapRaceModule', () => {
  it('first tap wins and ends the game', () => {
    const start = game.createInitialState(players, rng);
    expect(game.isOver(start)).toBe(false);

    const result = game.reduce(start, { playerId: 'b', action: { type: 'tap' } }, rng);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.winnerId).toBe('b');
    expect(result.events).toEqual([{ type: 'won', playerId: 'b' }]);
    expect(game.isOver(result.state)).toBe(true);
  });

  it('rejects taps after the race is over', () => {
    const start = game.createInitialState(players, rng);
    const won = game.reduce(start, { playerId: 'a', action: { type: 'tap' } }, rng);
    if (!won.ok) throw new Error(won.error.message);
    const late = game.reduce(won.state, { playerId: 'b', action: { type: 'tap' } }, rng);
    expect(late).toMatchObject({ ok: false, error: { code: 'wrong_phase' } });
  });

  it('rejects taps from players not in the game', () => {
    const start = game.createInitialState(players, rng);
    const result = game.reduce(start, { playerId: 'z', action: { type: 'tap' } }, rng);
    expect(result.ok).toBe(false);
  });

  it('keeps youWon out of the host view', () => {
    const state = { players, winnerId: 'a' };
    expect(game.getHostView(state)).not.toHaveProperty('youWon');
    expect(game.getPlayerView(state, 'a').youWon).toBe(true);
    expect(game.getPlayerView(state, 'b').youWon).toBe(false);
  });

  it('validates action payloads', () => {
    expect(game.actionSchema.safeParse({ type: 'tap' }).success).toBe(true);
    expect(game.actionSchema.safeParse({ type: 'win' }).success).toBe(false);
  });
});
