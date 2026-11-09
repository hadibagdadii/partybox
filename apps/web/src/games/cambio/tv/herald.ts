import { theme, type CambioEvent, type CambioHostView, type NameOf } from '@partybox/cambio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { herald } from '../../../lib/herald';
import { nameLookup } from '../format';
import { eventsSince, type LogCursor } from '../motion/queue';

/** The spoken line for one public event, or null to stay quiet. Never more than the log says. */
export function cambioHeraldLine(event: CambioEvent, name: NameOf): string | null {
  const h = theme.herald;
  switch (event.type) {
    case 'turnStarted':
      return h.turn(name(event.playerId));
    case 'cambioCalled':
      return h.called(name(event.playerId));
    case 'snapped':
      return h.snapped(name(event.snapperId));
    case 'snapFailed':
      return h.wrongSnap(name(event.snapperId));
    case 'roundRevealed': {
      const { winners, scores } = event.result;
      return h.roundWinner(winners.map(name), scores[winners[0] ?? ''] ?? 0);
    }
    case 'gameOver':
      return h.gameWinner(event.winners.map(name));
    default:
      return null;
  }
}

/** Turns on narration (and card sounds, which listen for the same tap). */
export const enableCambioHerald = () => herald.enable(theme.herald.ready);

/**
 * Narrates new public events and returns the caption to show. Captions always show, muted or
 * not. The first view only sets a baseline, so a refresh never repeats old lines.
 */
export function useCambioHerald(view: CambioHostView): string | null {
  const name = useMemo(() => nameLookup(view), [view]);
  const [caption, setCaption] = useState<string | null>(null);
  const cursor = useRef<LogCursor | null>(null);

  useEffect(() => {
    if (!cursor.current) {
      cursor.current = { round: view.round, length: view.log.length };
      return;
    }
    const { events, cursor: next } = eventsSince(cursor.current, view);
    cursor.current = next;
    for (const e of events) {
      const line = cambioHeraldLine(e, name);
      if (!line) continue;
      setCaption(line);
      herald.say(line);
    }
  }, [view, name]);

  return caption;
}
