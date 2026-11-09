import { describe, expect, it } from 'vitest';
import { contrast } from '../lib/contrast';
import { colors as c } from './tokens';

const text: [string, string, string][] = [
  ['paper on night', c.paper, c.night],
  ['paper on dusk', c.paper, c.dusk],
  ['lavender on night', c.lavender, c.night],
  ['lavender on dusk', c.lavender, c.dusk],
  ['punch on night (room code, links)', c.punch, c.night],
  ['punch on dusk (step numbers)', c.punch, c.dusk],
  ['ink on punch (primary button)', c.ink, c.punch],
  ['ink on deep punch (hover)', c.ink, c.punchDeep],
  ['ink on paper (secondary button)', c.ink, c.paper],
  ['white on danger', '#ffffff', c.danger],
];

describe('Partybox contrast', () => {
  it.each(text)('%s is at least 4.5:1', (_, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('the focus ring (punch) stands out from every surface at 3:1', () => {
    for (const bg of [c.night, c.dusk]) expect(contrast(c.punch, bg)).toBeGreaterThanOrEqual(3);
  });
});
