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

  it('has phone copy for every phase and targeted power', () => {
    for (const phase of Object.keys(theme.phases) as (keyof typeof theme.phases)[]) {
      expect(theme.phone.waiting[phase]('A')).toBeTruthy();
    }
    expect(theme.phone.powerHints.investigate).toBeTruthy();
    expect(theme.phone.powerHints.specialElection).toBeTruthy();
    expect(theme.phone.powerHints.execution).toBeTruthy();
  });

  it('writes log entries as sentences', () => {
    expect(theme.log.nominated('Amina', 'Yusuf')).toBe(
      `Amina nominated Yusuf as ${theme.offices.wazir}.`,
    );
    expect(theme.log.powerUsed('Amina', theme.powers.execution, 'Yusuf')).toMatch(/\.$/);
    expect(theme.log.powerUsed('Amina', theme.powers.policyPeek, null)).toMatch(/\.$/);
  });

  it('has TV copy for every phase and power', () => {
    const { instruction } = theme.tv;
    expect(instruction.nominate('Amina')).toContain('Amina');
    expect(instruction.vote('Amina', 'Yusuf')).toContain('Yusuf');
    for (const id of POWER_IDS) expect(instruction.power[id]('Amina')).toContain('Amina');
    expect(theme.tv.voteTally(true, 4, 3)).toContain('4');
  });

  it('keeps the herald vote line to the result and tally', () => {
    const { herald } = theme;
    const line = herald.vote(true, herald.numbers[4]!, herald.numbers[3]!);
    expect(line).toBe('The vote passes, four to three.');
    expect(herald.numbers).toHaveLength(11);
  });

  it('credits the original authors', () => {
    expect(theme.about.attribution).toBe(
      'Diwan is adapted from Secret Hitler by Max Temkin, Mike Boxleiter, Tommy Maranges, and Mackenzie Schubert, licensed under CC BY-NC-SA 4.0. This adaptation is free and shared under the same license.',
    );
    expect(theme.about.licenseUrl).toBe('https://creativecommons.org/licenses/by-nc-sa/4.0/');
  });

  it('has seven short tutorial slides', () => {
    expect(theme.tutorial.slides).toHaveLength(7);
    for (const slide of theme.tutorial.slides) {
      expect(slide.title).toBeTruthy();
      expect(slide.body.length).toBeLessThan(260);
      expect(slide.herald.length).toBeLessThan(70);
    }
  });
});
