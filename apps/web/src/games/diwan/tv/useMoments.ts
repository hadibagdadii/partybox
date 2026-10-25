import type { LogEntry } from '@partybox/diwan';
import { useEffect, useRef, useState } from 'react';
import { momentsFrom, type Moment } from '../court-record';

/** How long each moment holds the screen, in ms. */
export const MOMENT_MS = {
  voteReveal: { full: 4000, reduced: 2500 },
  enacted: { full: 1400, reduced: 600 },
  riot: { full: 3200, reduced: 1500 },
  exiled: { full: 2800, reduced: 2000 },
} as const;

/** Past this many queued moments, each one plays at half length so the TV catches up. */
const BACKLOG = 2;

/** A queued moment; `id` keys its overlay so it mounts once. */
export type QueuedMoment = Exclude<Moment, { kind: 'gameOver' }> & { id: number };

/**
 * Big moments from log entries that arrive while the TV is watching. The first
 * render only sets a baseline, so a refresh never replays history. The server never
 * waits for these; they only decorate state the view already shows.
 */
export function useMoments(log: readonly LogEntry[], reduced: boolean) {
  const seen = useRef<number | null>(null);
  const [queue, setQueue] = useState<QueuedMoment[]>([]);
  const nextId = useRef(0);
  const backlog = useRef(0);
  backlog.current = queue.length;

  useEffect(() => {
    if (seen.current === null || log.length < seen.current) {
      // First look, or a new game in the same room.
      seen.current = log.length;
      setQueue([]);
      return;
    }
    if (log.length === seen.current) return;
    const fresh = momentsFrom(log, seen.current)
      .filter((m): m is Exclude<Moment, { kind: 'gameOver' }> => m.kind !== 'gameOver')
      .map((m) => ({ ...m, id: nextId.current++ }));
    seen.current = log.length;
    if (fresh.length) setQueue((q) => [...q, ...fresh]);
  }, [log]);

  const current = queue[0] ?? null;
  useEffect(() => {
    if (!current) return;
    const base = MOMENT_MS[current.kind][reduced ? 'reduced' : 'full'];
    const ms = backlog.current > BACKLOG ? base / 2 : base;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), ms);
    return () => clearTimeout(t);
  }, [current, reduced]);

  return { current, pending: queue };
}
