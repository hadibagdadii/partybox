import { theme, type LogEntry } from '@partybox/diwan';

export type Names = (id: string | null | undefined) => string;

export function nameLookup(players: { id: string; name: string }[]): Names {
  const byId = new Map(players.map((p) => [p.id, p.name]));
  return (id) => (id ? (byId.get(id) ?? '?') : '-');
}

/** One public log entry as plain text, with every themed word from theme.ts. */
export function formatLog(entry: LogEntry, name: Names): string {
  const { offices, decrees, powers, votes } = theme;
  switch (entry.type) {
    case 'nominated':
      return `${offices.ameer} ${name(entry.ameerId)} nominated ${name(entry.wazirId)} as ${offices.wazir}`;
    case 'votesRevealed': {
      const by = (v: 'yes' | 'no') =>
        Object.entries(entry.votes)
          .filter(([, vote]) => vote === v)
          .map(([id]) => name(id))
          .join(', ') || '-';
      return `Vote ${entry.passed ? 'passed' : 'failed'} · ${votes.yes.label}: ${by('yes')} · ${votes.no.label}: ${by('no')}`;
    }
    case 'unrest':
      return `${theme.electionTracker} rises to ${entry.level}`;
    case 'riot':
      return `${theme.chaos}! ${decrees[entry.decree]} enacted`;
    case 'enacted':
      return `${name(entry.ameerId)} and ${name(entry.wazirId)} enacted a ${decrees[entry.decree]}`;
    case 'reshuffled':
      return `Deck reshuffled (${entry.drawCount} cards)`;
    case 'vetoProposed':
      return `${offices.wazir} ${name(entry.wazirId)} proposed a ${theme.veto}`;
    case 'vetoAnswered':
      return `${offices.ameer} ${name(entry.ameerId)} ${entry.accept ? 'accepted' : 'refused'} the ${theme.veto}`;
    case 'powerUsed':
      return `${name(entry.ameerId)} used ${powers[entry.power]}${entry.targetId ? ` on ${name(entry.targetId)}` : ''}`;
    case 'exiled':
      return `${name(entry.targetId)} is gone (${powers.execution})`;
    case 'gameOver':
      return `${theme.teams[entry.winner]} win: ${theme.winReasons[entry.reason]}`;
  }
}
