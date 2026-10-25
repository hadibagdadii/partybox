import { createRng } from '@partybox/shared';
import { describe, expect, it } from 'vitest';
import { diwanModule } from './index.js';
import { DECREE_IDS, OFFICE_IDS, ROLE_IDS, TEAM_IDS } from './ids.js';
import { theme } from './theme.js';

describe('theme', () => {
  it('names every neutral id', () => {
    for (const id of TEAM_IDS) expect(theme.teams[id]).toBeTruthy();
    for (const id of ROLE_IDS) expect(theme.roles[id]).toBeTruthy();
    for (const id of OFFICE_IDS) expect(theme.offices[id]).toBeTruthy();
    for (const id of DECREE_IDS) expect(theme.decrees[id]).toBeTruthy();
  });

  it('credits the original authors', () => {
    expect(theme.attribution).toContain('Secret Hitler');
    expect(theme.attribution).toContain('CC BY-NC-SA 4.0');
  });
});

describe('diwanModule stub', () => {
  it('host view exposes only public info', () => {
    const state = diwanModule.setup(['a', 'b', 'c', 'd', 'e'], createRng(1));
    expect(diwanModule.getHostView(state)).toEqual({ playerCount: 5 });
  });
});
