import { theme, type LogEntry, type VoteId } from '@partybox/diwan';
import { describe, expect, it } from 'vitest';
import { groupRounds, momentsFrom, roundSummary, trackSources, voteBadges } from './court-record';
import { nameLookup } from './format';

const players = ['Amina', 'Yusuf', 'Layla', 'Omar', 'Zainab', 'Idris', 'Noor'].map((name, i) => ({
  id: `p${i + 1}`,
  name,
}));
const name = nameLookup(players);

/** Votes with `yes` yes votes out of seven. */
function votes(yes: number): Record<string, VoteId> {
  return Object.fromEntries(players.map((p, i) => [p.id, i < yes ? 'yes' : 'no']));
}

const log: LogEntry[] = [
  // Round 1-3: three failed votes, the third sets off a Riot.
  { type: 'nominated', ameerId: 'p1', wazirId: 'p2' },
  { type: 'votesRevealed', votes: votes(3), passed: false },
  { type: 'unrest', level: 1 },
  { type: 'nominated', ameerId: 'p2', wazirId: 'p3' },
  { type: 'votesRevealed', votes: votes(2), passed: false },
  { type: 'unrest', level: 2 },
  { type: 'nominated', ameerId: 'p3', wazirId: 'p4' },
  { type: 'votesRevealed', votes: votes(1), passed: false },
  { type: 'unrest', level: 3 },
  { type: 'riot', decree: 'rebel' },
  // Round 4: a government, a power, and an exile.
  { type: 'nominated', ameerId: 'p4', wazirId: 'p5' },
  { type: 'votesRevealed', votes: votes(4), passed: true },
  { type: 'enacted', decree: 'rebel', ameerId: 'p4', wazirId: 'p5' },
  { type: 'powerUsed', power: 'execution', ameerId: 'p4', targetId: 'p6' },
  { type: 'exiled', targetId: 'p6' },
  // Round 5: an accepted veto.
  { type: 'nominated', ameerId: 'p5', wazirId: 'p1' },
  { type: 'votesRevealed', votes: votes(5), passed: true },
  { type: 'vetoProposed', wazirId: 'p1' },
  { type: 'vetoAnswered', ameerId: 'p5', accept: true },
  { type: 'unrest', level: 1 },
  // Round 6: a refused veto, an enactment, and the end.
  { type: 'nominated', ameerId: 'p7', wazirId: 'p3' },
  { type: 'votesRevealed', votes: votes(6), passed: true },
  { type: 'vetoProposed', wazirId: 'p3' },
  { type: 'vetoAnswered', ameerId: 'p7', accept: false },
  { type: 'reshuffled', drawCount: 9 },
  { type: 'enacted', decree: 'loyal', ameerId: 'p7', wazirId: 'p3' },
  { type: 'gameOver', winner: 'loyal', reason: 'loyalDecrees' },
];

describe('groupRounds', () => {
  const rounds = groupRounds(log, name);
  const kinds = (n: number) => rounds[n - 1]!.items.map((i) => i.kind);

  it('opens a round at each nomination', () => {
    expect(rounds.map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('marks failed nominations and keeps a Riot in the round of the third failure', () => {
    expect(kinds(1)).toEqual(['nominationFailed', 'voteFailed', 'unrest']);
    expect(kinds(3)).toEqual(['nominationFailed', 'voteFailed', 'unrest', 'riot']);
    expect(rounds[2]!.items[3]!.text).toBe(theme.record.riot(theme.decrees.rebel));
  });

  it('groups a government with its power and exile', () => {
    expect(kinds(4)).toEqual(['nominationPassed', 'votePassed', 'enacted', 'power', 'exiled']);
    expect(rounds[3]!.items[3]!.text).toBe(theme.record.power(theme.powers.execution, 'Idris'));
  });

  it('records accepted and refused vetoes', () => {
    expect(kinds(5)).toEqual(['nominationPassed', 'votePassed', 'veto', 'veto', 'unrest']);
    expect(rounds[4]!.items[3]!.text).toBe(theme.record.vetoAnswered('Zainab', true));
    expect(kinds(6)).toEqual([
      'nominationPassed',
      'votePassed',
      'veto',
      'veto',
      'reshuffled',
      'enacted',
      'gameOver',
    ]);
    expect(rounds[5]!.items[3]!.text).toBe(theme.record.vetoAnswered('Noor', false));
  });

  it('leaves the newest nomination pending until its vote', () => {
    const open = groupRounds([...log.slice(0, 11)], name);
    expect(open.at(-1)!.items.map((i) => i.kind)).toEqual(['nominated']);
  });

  it('summarizes a round on one line', () => {
    expect(roundSummary(rounds[3]!)).toBe(
      [
        theme.record.round(4),
        theme.record.nominated('Omar', 'Zainab'),
        theme.record.vote(true, 4, 3),
        theme.record.enacted(theme.decrees.rebel),
        theme.record.power(theme.powers.execution, 'Idris'),
        theme.record.exiled('Idris'),
      ].join(' · '),
    );
  });

  it('is empty for an empty log', () => {
    expect(groupRounds([], name)).toEqual([]);
  });
});

describe('voteBadges', () => {
  it('shows the latest reveal until the next nomination', () => {
    expect(voteBadges(log)).toEqual(votes(6));
    expect(voteBadges([...log, { type: 'nominated', ameerId: 'p1', wazirId: 'p2' }])).toEqual({});
    expect(voteBadges([])).toEqual({});
  });
});

describe('trackSources', () => {
  it('tells Riot decrees from elected ones, in slot order', () => {
    expect(trackSources(log)).toEqual({ loyal: ['government'], rebel: ['riot', 'government'] });
  });
});

describe('momentsFrom', () => {
  it('turns only new entries into moments, with track slots counted from the start', () => {
    const from = log.findIndex((e) => e.type === 'nominated' && e.ameerId === 'p4');
    expect(momentsFrom(log.slice(0, 16), from)).toEqual([
      { kind: 'voteReveal', votes: votes(4), passed: true },
      { kind: 'enacted', decree: 'rebel', slot: 1 },
      { kind: 'exiled', targetId: 'p6' },
    ]);
    expect(momentsFrom(log, log.length - 1)).toEqual([{ kind: 'gameOver' }]);
    expect(momentsFrom(log.slice(0, 10), 7)).toEqual([
      { kind: 'voteReveal', votes: votes(1), passed: false },
      { kind: 'riot', decree: 'rebel', slot: 0 },
    ]);
  });
});
