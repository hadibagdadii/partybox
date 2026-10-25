import { describe, expect, it } from 'vitest';
import { elect, makeGame, rebels } from './test-helpers.js';
import { getHostView, getPlayerView } from './views.js';

describe('host view', () => {
  it('contains only public information', () => {
    const s = elect(makeGame({ deck: rebels(5) }), 'p1');
    const host = getHostView(s);
    expect(host.roles).toBeNull();
    expect(host.drawCount).toBe(2);
    expect(Object.keys(host)).not.toEqual(expect.arrayContaining(['hand']));
    for (const p of host.players) expect(Object.keys(p).sort()).toEqual(['alive', 'id', 'name']);
    expect(JSON.stringify(host)).not.toMatch(/usurper|"role"|"draw"|"hand"|secrets/);
  });

  it('lists eligible Wazirs only during nomination', () => {
    const s = makeGame();
    expect(getHostView(s).eligibleWazirIds.sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(getHostView(elect(s, 'p1')).eligibleWazirIds).toEqual([]);
  });

  it('shares the public log with every player', () => {
    const s = elect(makeGame({ deck: rebels(5) }), 'p1');
    for (const p of s.players) expect(getPlayerView(s, p.id).log).toEqual(getHostView(s).log);
  });
});

describe('player view', () => {
  it('shows your own role and team', () => {
    const s = makeGame();
    expect(getPlayerView(s, 'p0').you).toEqual({
      id: 'p0',
      role: 'loyal',
      team: 'loyal',
      alive: true,
    });
    expect(getPlayerView(s, 'p4').you).toMatchObject({ role: 'usurper', team: 'rebel' });
  });

  it('gives an unseated id public information only', () => {
    const view = getPlayerView(makeGame(), 'spectator');
    expect(view.you).toBeNull();
    expect(view.knownRoles).toEqual({});
    expect(view.hand).toBeNull();
    expect(view.roles).toBeNull();
  });

  it('keeps the exiled informed of their own role', () => {
    const s = makeGame();
    s.players[3]!.alive = false;
    expect(getPlayerView(s, 'p3').you).toMatchObject({ role: 'rebel', alive: false });
    expect(getPlayerView(s, 'p3').knownRoles).toEqual({ p3: 'rebel', p4: 'usurper' });
  });
});
