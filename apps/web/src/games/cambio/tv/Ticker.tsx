import { theme, type CambioEvent, type CambioHostView, type NameOf } from '@partybox/cambio';
import { AnimatePresence, motion } from 'motion/react';
import { colors, ease } from '../tokens';

/** Too frequent or too small to be worth a line. */
const QUIET = new Set<CambioEvent['type']>(['ready', 'drew', 'turnStarted']);

/** The newest `n` lines the ticker shows, up to what has started playing on the table. */
export function tickerLines(
  log: readonly CambioEvent[],
  pending: number,
  name: NameOf,
  n = 2,
): { key: number; text: string }[] {
  const shown = log.slice(0, Math.max(0, log.length - pending));
  const out: { key: number; text: string }[] = [];
  for (let i = shown.length - 1; i >= 0 && out.length < n; i--) {
    const e = shown[i]!;
    if (QUIET.has(e.type)) continue;
    out.unshift({ key: i, text: theme.describe(e, name) });
  }
  return out;
}

/**
 * The last couple of things that happened, in plain sentences, along the bottom edge. It
 * follows the table, so the words never get ahead of the cards.
 */
export function Ticker({
  view,
  pending,
  name,
  reduced,
}: {
  view: CambioHostView;
  pending: number;
  name: NameOf;
  reduced: boolean;
}) {
  const lines = tickerLines(view.log, pending, name);
  return (
    <section
      aria-label={theme.tv.events}
      data-testid="ticker"
      className="flex h-full min-w-0 flex-col justify-end font-card"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {lines.map((l, i) => {
          const newest = i === lines.length - 1;
          return (
            <motion.p
              key={`${view.round}:${l.key}`}
              layout={reduced ? false : 'position'}
              className="truncate leading-tight [font-stretch:92%]"
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: newest ? 1 : 0.5, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: ease.outCubic }}
              style={{
                fontSize: newest ? 26 : 21,
                fontWeight: newest ? 600 : 500,
                color: newest ? colors.chalk : colors.chalkDim,
              }}
            >
              {l.text}
            </motion.p>
          );
        })}
      </AnimatePresence>
    </section>
  );
}
