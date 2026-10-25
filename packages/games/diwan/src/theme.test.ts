import { describe, expect, it } from 'vitest';
import { DECREE_IDS, OFFICE_IDS, POWER_IDS, ROLE_IDS, TEAM_IDS, VOTE_IDS } from './ids.js';
import { theme } from './theme.js';

describe('theme', () => {
  it('names every neutral id', () => {
    for (const id of TEAM_IDS) expect(theme.teams[id]).toBeTruthy();
    for (const id of ROLE_IDS) expect(theme.roles[id]).toBeTruthy();
    for (const id of OFFICE_IDS) expect(theme.offices[id]).toBeTruthy();
    for (const id of DECREE_IDS) expect(theme.decrees[id]).toBeTruthy();
    for (const id of POWER_IDS) expect(theme.powers[id]).toBeTruthy();
    for (const id of VOTE_IDS) {
      expect(theme.votes[id].label).toBeTruthy();
      expect(theme.votes[id].subtitle).toBeTruthy();
    }
  });

  it('credits the original authors', () => {
    expect(theme.attribution).toContain('Secret Hitler');
    expect(theme.attribution).toContain('CC BY-NC-SA 4.0');
  });
});
