import { theme, type LogEntry } from '@partybox/diwan';

export type Names = (id: string | null | undefined) => string;

export function nameLookup(players: { id: string; name: string }[]): Names {
  const byId = new Map(players.map((p) => [p.id, p.name]));
  return (id) => (id ? (byId.get(id) ?? '?') : '-');
}

/** Joins names as plain English: "A", "A and B", "A, B and C". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** One public log entry as a plain sentence, with every themed word from theme.ts. */
export function formatLog(entry: LogEntry, name: Names): string {
  const { log, decrees, powers } = theme;
  switch (entry.type) {
    case 'nominated':
      return log.nominated(name(entry.ameerId), name(entry.wazirId));
    case 'votesRevealed': {
      const by = (v: 'yes' | 'no') =>
        listNames(
          Object.entries(entry.votes)
            .filter(([, vote]) => vote === v)
            .map(([id]) => name(id)),
        ) || log.nobody;
      return log.votesRevealed(entry.passed, by('yes'), by('no'));
    }
    case 'unrest':
      return log.unrest(entry.level);
    case 'riot':
      return log.riot(decrees[entry.decree]);
    case 'enacted':
      return log.enacted(name(entry.ameerId), name(entry.wazirId), decrees[entry.decree]);
    case 'reshuffled':
      return log.reshuffled(entry.drawCount);
    case 'vetoProposed':
      return log.vetoProposed(name(entry.wazirId));
    case 'vetoAnswered':
      return log.vetoAnswered(name(entry.ameerId), entry.accept);
    case 'powerUsed':
      return log.powerUsed(
        name(entry.ameerId),
        powers[entry.power],
        entry.targetId ? name(entry.targetId) : null,
      );
    case 'exiled':
      return log.exiled(name(entry.targetId));
    case 'gameOver':
      return log.gameOver(theme.teams[entry.winner], theme.winReasons[entry.reason]);
  }
}
