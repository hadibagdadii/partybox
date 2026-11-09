import { describe, expect, it } from 'vitest';
import { FIXTURE_IDS, buildFixture, type FixtureId } from './fixtures.js';
import type { CambioEventType } from './state.js';

/** The event each fixture exists to show. */
const shows: Record<FixtureId, CambioEventType> = {
  deal: 'dealt',
  draw: 'drew',
  swap: 'swapped',
  discard: 'discardedDrawn',
  peekOwn: 'powerUsed',
  peekOther: 'powerUsed',
  blindSwap: 'blindSwap',
  kingSwap: 'kingSwap',
  snap: 'snapped',
  snapGive: 'snapped',
  wrongSnap: 'snapFailed',
  reshuffle: 'reshuffled',
  call: 'cambioCalled',
  reveal: 'roundRevealed',
  burst: 'snapped',
  holes: 'snapFailed',
  chain: 'snapped',
  wrongSnapOther: 'snapFailed',
  lockedCall: 'cambioCalled',
  peekPhase: 'ready',
  matchRoundEnd: 'roundRevealed',
  gameOver: 'gameOver',
};

describe.each([6, 12])('fixtures on a %i-player table', (count) => {
  it.each(FIXTURE_IDS)('%s plays its event', (id) => {
    const f = buildFixture(id, count);
    expect(f.before.host.players).toHaveLength(count);
    const types = f.steps.flatMap((s) => s.events.map((e) => e.type));
    expect(types).toContain(shows[id]);
  });

  it('snapGive gives a card and wrongSnap draws a penalty', () => {
    const give = buildFixture('snapGive', count).steps[0]!.events[0];
    expect(give).toMatchObject({ type: 'snapped', give: { slotId: expect.any(String) } });
    const wrong = buildFixture('wrongSnap', count).steps[0]!.events[0];
    expect(wrong).toMatchObject({ type: 'snapFailed', penalty: { slotId: expect.any(String) } });
  });

  it('burst has about 30 events with racing snaps', () => {
    const f = buildFixture('burst', count);
    const types = f.steps.flatMap((s) => s.events.map((e) => e.type));
    expect(types.length).toBeGreaterThanOrEqual(25);
    expect(types).toContain('snapFailed');
  });
});

describe('fixtures for the TV moments', () => {
  it('chains three snaps on one discard', () => {
    const f = buildFixture('chain', 6);
    expect(f.steps.map((s) => s.events.map((e) => e.type))).toEqual([
      ['snapped'],
      ['snapped'],
      ['snapped'],
    ]);
  });

  it('a wrong snap of another player puts the penalty on the snapper', () => {
    const f = buildFixture('wrongSnapOther', 6);
    const e = f.steps[0]!.events[0]!;
    expect(e).toMatchObject({ type: 'snapFailed', snapperId: 'p2', ownerId: 'p1' });
  });

  it('a locked call keeps the caller locked', () => {
    const f = buildFixture('lockedCall', 6);
    expect(f.steps.at(-1)!.host.lockedPlayerId).toBe('p0');
  });

  it('the match round ends near the target without ending the match', () => {
    const f = buildFixture('matchRoundEnd', 12);
    const host = f.steps.at(-1)!.host;
    expect(host.phase).toBe('roundOver');
    expect(Math.max(...Object.values(host.totals))).toBeGreaterThan(60);
    expect(Math.max(...Object.values(host.totals))).toBeLessThan(100);
  });

  it('a single round ends the game', () => {
    expect(buildFixture('gameOver', 6).steps.at(-1)!.host.phase).toBe('over');
  });
});
