import { UNREST_LIMIT, theme, type DecreeId, type LogEntry, type VoteId } from '@partybox/diwan';
import type { Names } from './format';

/**
 * Pure helpers over the public log, shared by the TV and the phone. They read only
 * `LogEntry` values, which never carry roles, hands, or spy results.
 */

export type RecordKind =
  | 'nominated'
  | 'nominationPassed'
  | 'nominationFailed'
  | 'votePassed'
  | 'voteFailed'
  | 'unrest'
  | 'riot'
  | 'enacted'
  | 'reshuffled'
  | 'veto'
  | 'power'
  | 'exiled'
  | 'gameOver';

export interface RecordItem {
  kind: RecordKind;
  text: string;
  /** Set for decree items, so the icon can match the card. */
  decree?: DecreeId;
}

export interface Round {
  number: number;
  items: RecordItem[];
}

/** Yes and no counts of a revealed vote. */
export function voteTally(votes: Record<string, VoteId>): { yes: number; no: number } {
  const all = Object.values(votes);
  const yes = all.filter((v) => v === 'yes').length;
  return { yes, no: all.length - yes };
}

function toItem(entry: LogEntry, name: Names): RecordItem {
  const { record, decrees, powers, teams } = theme;
  switch (entry.type) {
    case 'nominated':
      return {
        kind: 'nominated',
        text: record.nominated(name(entry.ameerId), name(entry.wazirId)),
      };
    case 'votesRevealed': {
      const { yes, no } = voteTally(entry.votes);
      return {
        kind: entry.passed ? 'votePassed' : 'voteFailed',
        text: record.vote(entry.passed, yes, no),
      };
    }
    case 'unrest':
      return { kind: 'unrest', text: record.unrest(entry.level, UNREST_LIMIT) };
    case 'riot':
      return { kind: 'riot', text: record.riot(decrees[entry.decree]), decree: entry.decree };
    case 'enacted':
      return { kind: 'enacted', text: record.enacted(decrees[entry.decree]), decree: entry.decree };
    case 'reshuffled':
      return { kind: 'reshuffled', text: record.reshuffled(entry.drawCount) };
    case 'vetoProposed':
      return { kind: 'veto', text: record.vetoProposed(name(entry.wazirId)) };
    case 'vetoAnswered':
      return { kind: 'veto', text: record.vetoAnswered(name(entry.ameerId), entry.accept) };
    case 'powerUsed':
      return {
        kind: 'power',
        text: record.power(powers[entry.power], entry.targetId ? name(entry.targetId) : null),
      };
    case 'exiled':
      return { kind: 'exiled', text: record.exiled(name(entry.targetId)) };
    case 'gameOver':
      return { kind: 'gameOver', text: record.gameOver(teams[entry.winner]) };
  }
}

/** The log as rounds, oldest first. Each nomination opens a round; everything after it belongs to it. */
export function groupRounds(log: readonly LogEntry[], name: Names): Round[] {
  const rounds: Round[] = [];
  for (const entry of log) {
    if (entry.type === 'nominated' || rounds.length === 0) {
      rounds.push({ number: rounds.length + 1, items: [] });
    }
    const round = rounds[rounds.length - 1]!;
    // The vote settles how the nomination went; mark it on the nomination itself.
    if (entry.type === 'votesRevealed') {
      const nomination = round.items.find((i) => i.kind === 'nominated');
      if (nomination) nomination.kind = entry.passed ? 'nominationPassed' : 'nominationFailed';
    }
    round.items.push(toItem(entry, name));
  }
  return rounds;
}

/** One round as a single line: "Round 4 · Ameer Bot 1 nominated hadi · Passed 4-3 · …". */
export function roundSummary(round: Round): string {
  return [theme.record.round(round.number), ...round.items.map((i) => i.text)].join(' · ');
}

/** Votes from the latest reveal, until the next nomination clears them. */
export function voteBadges(log: readonly LogEntry[]): Record<string, VoteId> {
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i]!;
    if (entry.type === 'nominated') return {};
    if (entry.type === 'votesRevealed') return entry.votes;
  }
  return {};
}

export type TrackSource = 'government' | 'riot';

/** How each enacted decree got onto its track, in slot order. */
export function trackSources(log: readonly LogEntry[]): Record<DecreeId, TrackSource[]> {
  const out: Record<DecreeId, TrackSource[]> = { loyal: [], rebel: [] };
  for (const entry of log) {
    if (entry.type === 'enacted') out[entry.decree].push('government');
    if (entry.type === 'riot') out[entry.decree].push('riot');
  }
  return out;
}

export type Moment =
  | { kind: 'voteReveal'; votes: Record<string, VoteId>; passed: boolean }
  | { kind: 'enacted'; decree: DecreeId; slot: number }
  | { kind: 'riot'; decree: DecreeId; slot: number }
  | { kind: 'exiled'; targetId: string }
  | { kind: 'gameOver' };

/** Big moments for log entries at index `from` and later. Slots are 0-based. */
export function momentsFrom(log: readonly LogEntry[], from: number): Moment[] {
  const counts: Record<DecreeId, number> = { loyal: 0, rebel: 0 };
  const out: Moment[] = [];
  log.forEach((entry, i) => {
    if (entry.type === 'enacted' || entry.type === 'riot') {
      const slot = counts[entry.decree]++;
      if (i >= from) out.push({ kind: entry.type, decree: entry.decree, slot });
      return;
    }
    if (i < from) return;
    if (entry.type === 'votesRevealed') {
      out.push({ kind: 'voteReveal', votes: entry.votes, passed: entry.passed });
    } else if (entry.type === 'exiled') {
      out.push({ kind: 'exiled', targetId: entry.targetId });
    } else if (entry.type === 'gameOver') {
      out.push({ kind: 'gameOver' });
    }
  });
  return out;
}
