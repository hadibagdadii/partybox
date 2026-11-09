import { theme, type DiwanHostView, type LogEntry } from '@partybox/diwan';
import { useEffect, useMemo, useRef, useState } from 'react';
import { herald as shared } from '../../../lib/herald';
import { voteTally } from '../court-record';
import { nameLookup, type Names } from '../format';

/**
 * The court herald. It speaks only lines built from public log entries (plus the
 * fixed night line), so it can never say more than the court record shows.
 */

/** The spoken line for one public log entry, or null if the herald stays quiet. */
export function heraldLine(entry: LogEntry, name: Names): string | null {
  const { herald, decrees, powers, teams, winReasons } = theme;
  const say = (n: number) => herald.numbers[n] ?? String(n);
  switch (entry.type) {
    case 'nominated':
      return herald.nominated(name(entry.ameerId), name(entry.wazirId));
    case 'votesRevealed': {
      const { yes, no } = voteTally(entry.votes);
      return herald.vote(entry.passed, say(yes), say(no));
    }
    case 'riot':
      return herald.riot(decrees[entry.decree]);
    case 'enacted':
      return herald.enacted(decrees[entry.decree]);
    case 'powerUsed':
      return herald.powerUsed(
        name(entry.ameerId),
        powers[entry.power],
        entry.targetId ? name(entry.targetId) : null,
      );
    case 'exiled':
      return herald.exiled(name(entry.targetId));
    case 'gameOver':
      return herald.gameOver(teams[entry.winner], winReasons[entry.reason]);
    case 'unrest':
    case 'reshuffled':
    case 'vetoProposed':
    case 'vetoAnswered':
      return null;
  }
}

export {
  MAX_PENDING,
  useHeraldState,
  useVoices,
  type Speaker,
  type Voice,
} from '../../../lib/herald';

/** The shared herald; enabling it here announces the court herald. */
export const herald = { ...shared, enable: () => shared.enable(theme.tv.heraldReady) };

/**
 * Narrates new public log entries and the night phase, and returns the caption
 * to show. Captions always show, even when the herald is muted or not enabled.
 */
export function useHerald(view: DiwanHostView): string | null {
  const name = useMemo(() => nameLookup(view.players), [view.players]);
  const [caption, setCaption] = useState<string | null>(null);
  const seen = useRef<number | null>(null);
  const lastPhase = useRef<DiwanHostView['phase'] | null>(null);

  useEffect(() => {
    if (view.phase === 'reveal' && lastPhase.current !== 'reveal') {
      setCaption(theme.herald.night);
      herald.say(theme.herald.night);
    }
    lastPhase.current = view.phase;
  }, [view.phase]);

  useEffect(() => {
    const log = view.log;
    if (seen.current === null || log.length < seen.current) {
      seen.current = log.length;
      return;
    }
    const fresh = log.slice(seen.current);
    seen.current = log.length;
    for (const entry of fresh) {
      const line = heraldLine(entry, name);
      if (!line) continue;
      setCaption(line);
      herald.say(line);
    }
  }, [view.log, name]);

  return caption;
}
