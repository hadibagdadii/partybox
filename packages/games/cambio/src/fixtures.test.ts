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
