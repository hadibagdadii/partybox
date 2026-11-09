import { cardValue, type CambioHostView } from '@partybox/cambio';
import { useEffect, useState } from 'react';
import type { MotionFrame } from '../motion/useCambioMotion';
import { timing } from '../tokens';

export interface Tally {
  /** Each seat's total so far, by player id. Missing until a seat's first card turns. */
  totals: Record<string, number>;
  /** The reveal is playing: totals are still counting up. */
  counting: boolean;
}

/**
 * Each hand's total counting up as its cards turn over in the round's reveal, card by card in
 * time with the flips; the final scores once it's done (or at once, with reduced motion).
 */
export function useRevealTally(view: CambioHostView, frame: MotionFrame): Tally {
  const playing = frame.playing?.step.kind === 'reveal' ? frame.playing : null;
  const [live, setLive] = useState<{ id: number; totals: Record<string, number> } | null>(null);

  useEffect(() => {
    if (!playing) return;
    const e = playing.step.event;
    if (e.type !== 'roundRevealed') return;
    const k = playing.rate * frame.timeScale;
    setLive({ id: playing.id, totals: {} });
    const flipAt = new Map(playing.step.flips.map((f) => [f.cardId, f.delay]));
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const hand of e.result.hands) {
      let total = 0;
      hand.cards.forEach((c) => {
        total += cardValue(c.face);
        const value = total;
        // Counts as the card shows its face, halfway through the flip.
        const at = ((flipAt.get(c.cardId) ?? 0) + timing.revealFlip / 2) * k;
        timers.push(
          setTimeout(
            () =>
              setLive((cur) =>
                cur && cur.id === playing.id
                  ? { ...cur, totals: { ...cur.totals, [hand.playerId]: value } }
                  : cur,
              ),
            at,
          ),
        );
      });
      if (!hand.cards.length) {
        timers.push(
          setTimeout(
            () =>
              setLive((cur) =>
                cur && cur.id === playing.id
                  ? { ...cur, totals: { ...cur.totals, [hand.playerId]: 0 } }
                  : cur,
              ),
            0,
          ),
        );
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [playing, frame.timeScale]);

  if (playing && live?.id === playing.id) return { totals: live.totals, counting: true };
  const between = view.phase === 'roundOver' || view.phase === 'over';
  const done = between && view.lastRound?.round === view.round && !playing && frame.pending === 0;
  return { totals: done ? { ...view.lastRound!.scores } : {}, counting: false };
}
