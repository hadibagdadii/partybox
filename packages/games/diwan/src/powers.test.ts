import { describe, expect, it } from 'vitest';
import type { PowerId } from './ids.js';
import type { DiwanState } from './state.js';
import {
  act,
  attempt,
  failElection,
  makeGame,
  passDecree,
  rebels,
  type GameOptions,
} from './test-helpers.js';
import { getHostView, getPlayerView } from './views.js';

type Slots = [PowerId | null, PowerId | null, PowerId | null, PowerId | null, PowerId | null];

const SMALL: Slots = [null, null, 'policyPeek', 'execution', 'execution'];
const MEDIUM: Slots = [null, 'investigate', 'specialElection', 'execution', 'execution'];
const LARGE: Slots = ['investigate', 'investigate', 'specialElection', 'execution', 'execution'];
const TRACKS: Record<number, Slots> = {
  5: SMALL,
  6: SMALL,
  7: MEDIUM,
  8: MEDIUM,
  9: LARGE,
  10: LARGE,
};

/** Enacts a government rebel decree into `slot` (1-based). */
function enactRebelAt(slot: number, opts: GameOptions = {}): DiwanState {
  const s = makeGame({ deck: rebels(10), ...opts, enacted: { rebel: slot - 1 } });
  return passDecree(s, 'p1', 'rebel');
}

describe('power track', () => {
  for (const [count, slots] of Object.entries(TRACKS)) {
    slots.forEach((power, i) => {
      const slot = i + 1;
      it(`${count} players, slot ${slot}: ${power ?? 'no power'}`, () => {
        const s = enactRebelAt(slot, { count: Number(count) });
        expect(s.enacted.rebel).toBe(slot);
        expect(getHostView(s).powerTrack).toEqual(slots);
        if (power) {
          expect(s.phase).toBe('power');
          expect(s.pendingPower).toBe(power);
          expect(s.ameerId).toBe('p0');
        } else {
          expect(s.phase).toBe('nominate');
          expect(s.pendingPower).toBeNull();
          expect(s.ameerId).toBe('p1');
        }
      });
    });
  }

  it('loyal decrees grant no power', () => {
    const s = passDecree(makeGame({ count: 9, deck: ['loyal', 'loyal', 'loyal'] }), 'p1', 'loyal');
    expect(s.phase).toBe('nominate');
  });

  it('a riot onto a power slot grants no power', () => {
    let s = makeGame({ count: 9, deck: rebels(5), unrest: 2 });
    s = failElection(s, 'p1');
    expect(s.enacted.rebel).toBe(1);
    expect(s.phase).toBe('nominate');
    expect(s.pendingPower).toBeNull();
  });

  it('only the Ameer may use the power, and only the pending one', () => {
    const s = enactRebelAt(2, { count: 7 });
    expect(attempt(s, 'p1', { type: 'investigate', targetId: 'p3' })).toMatchObject({
      ok: false,
      error: { code: 'not_your_turn' },
    });
    expect(attempt(s, 'p0', { type: 'execution', targetId: 'p3' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
    expect(attempt(s, 'p0', { type: 'nominate', targetId: 'p3' })).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });
});

describe('Send a Spy', () => {
  it('shows the target team only to the Ameer; the Usurper shows as rebel', () => {
    let s = enactRebelAt(2, { count: 7 });
    expect(getHostView(s).powerTargetIds).not.toContain('p0');
    s = act(s, 'p0', { type: 'investigate', targetId: 'p6' }); // p6 is the Usurper
    expect(getPlayerView(s, 'p0').secrets).toEqual([
      { type: 'investigate', targetId: 'p6', team: 'rebel' },
    ]);
    expect(getPlayerView(s, 'p6').secrets).toEqual([]);
    expect(s.log.at(-1)).toEqual({
      type: 'powerUsed',
      power: 'investigate',
      ameerId: 'p0',
      targetId: 'p6',
    });
    expect(JSON.stringify(getHostView(s))).not.toContain('team');
    expect(s.phase).toBe('nominate');
    expect(s.ameerId).toBe('p1');
  });

  it('reports loyalists as loyal', () => {
    const s = act(enactRebelAt(2, { count: 7 }), 'p0', { type: 'investigate', targetId: 'p2' });
    expect(getPlayerView(s, 'p0').secrets[0]).toMatchObject({ team: 'loyal' });
  });

  it('cannot target yourself', () => {
    const s = enactRebelAt(2, { count: 7 });
    expect(attempt(s, 'p0', { type: 'investigate', targetId: 'p0' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_action' },
    });
  });

  it('cannot spy on the same player twice', () => {
    // 9 players: slots 1 and 2 both spy.
    let s = enactRebelAt(1, { count: 9 });
    s = act(s, 'p0', { type: 'investigate', targetId: 'p5' });
    // p1 is Ameer now; elect p2 and enact the second rebel decree.
    s = passDecree(s, 'p2', 'rebel');
    expect(s.pendingPower).toBe('investigate');
    expect(getHostView(s).powerTargetIds).not.toContain('p5');
    expect(attempt(s, 'p1', { type: 'investigate', targetId: 'p5' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_action' },
    });
    s = act(s, 'p1', { type: 'investigate', targetId: 'p6' });
    expect(s.spiedIds).toEqual(['p5', 'p6']);
  });
});

describe('Name a Successor', () => {
  it('the successor serves one round, then rotation resumes after the naming Ameer', () => {
    let s = enactRebelAt(3, { count: 7 });
    s = act(s, 'p0', { type: 'specialElection', targetId: 'p4' });
    expect(s.ameerId).toBe('p4');
    s = failElection(s, 'p2');
    expect(s.ameerId).toBe('p1');
    s = failElection(s, 'p3');
    expect(s.ameerId).toBe('p2');
  });

  it('naming the next player in order gives them two turns in a row', () => {
    let s = enactRebelAt(3, { count: 7 });
    s = act(s, 'p0', { type: 'specialElection', targetId: 'p1' });
    expect(s.ameerId).toBe('p1');
    s = failElection(s, 'p2');
    expect(s.ameerId).toBe('p1');
    s = failElection(s, 'p2');
    expect(s.ameerId).toBe('p2');
  });

  it('cannot name yourself or an exiled player', () => {
    const s = enactRebelAt(3, { count: 9 });
    s.players[5]!.alive = false;
    for (const targetId of ['p0', 'p5']) {
      expect(attempt(s, 'p0', { type: 'specialElection', targetId })).toMatchObject({
        ok: false,
        error: { code: 'invalid_action' },
      });
    }
  });
});

describe('Exile', () => {
  it('removes the player without revealing their role', () => {
    let s = enactRebelAt(4, { count: 5 });
    s = act(s, 'p0', { type: 'execution', targetId: 'p3' }); // p3 is a rebel
    expect(s.players[3]?.alive).toBe(false);
    expect(s.log.slice(-2)).toEqual([
      { type: 'powerUsed', power: 'execution', ameerId: 'p0', targetId: 'p3' },
      { type: 'exiled', targetId: 'p3' },
    ]);
    const host = getHostView(s);
    expect(host.roles).toBeNull();
    expect(host.players[3]).toEqual({ id: 'p3', name: 'Player 3', alive: false });
    expect(s.phase).toBe('nominate');
  });

  it('works on slot 5 too, and the exiled player cannot act or be targeted again', () => {
    let s = enactRebelAt(4, { count: 8 });
    s = act(s, 'p0', { type: 'execution', targetId: 'p2' });
    expect(attempt(s, 'p2', { type: 'nominate', targetId: 'p3' })).toMatchObject({
      ok: false,
      error: { code: 'not_your_turn' },
    });
    s = passDecree(s, 'p3', 'rebel');
    expect(s.pendingPower).toBe('execution');
    expect(attempt(s, 'p1', { type: 'execution', targetId: 'p2' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_action' },
    });
    expect(attempt(s, 'p1', { type: 'execution', targetId: 'p1' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_action' },
    });
  });

  it('skips the exiled player for Ameer', () => {
    let s = enactRebelAt(4, { count: 5 });
    s = act(s, 'p0', { type: 'execution', targetId: 'p1' });
    expect(s.ameerId).toBe('p2');
  });
});

describe('Read the Scrolls', () => {
  it('shows the top 3 decrees to the Ameer only, then continues', () => {
    let s = makeGame({
      deck: [...rebels(3), 'loyal', 'rebel', 'loyal', 'rebel'],
      enacted: { rebel: 2 },
    });
    s = passDecree(s, 'p1', 'rebel');
    expect(s.pendingPower).toBe('policyPeek');
    expect(getPlayerView(s, 'p0').peek).toEqual(['loyal', 'rebel', 'loyal']);
    expect(getPlayerView(s, 'p1').peek).toBeNull();
    expect(getPlayerView(s, 'p0').secrets).toEqual([
      { type: 'policyPeek', cards: ['loyal', 'rebel', 'loyal'] },
    ]);
    expect(getHostView(s).drawCount).toBe(4);

    s = act(s, 'p0', { type: 'policyPeekDone' });
    expect(s.log.at(-1)).toEqual({ type: 'powerUsed', power: 'policyPeek', ameerId: 'p0' });
    expect(s.draw).toEqual(['loyal', 'rebel', 'loyal', 'rebel']);
    expect(s.phase).toBe('nominate');
    expect(getPlayerView(s, 'p0').peek).toBeNull();
  });
});
