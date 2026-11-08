import { theme, type CambioPlayerView, type RoundResult } from '@partybox/cambio';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import type { PhoneLayout } from '../motion/layout';
import { colors, ease } from '../tokens';

/**
 * The round's result over the middle of the table, leaving your flipped hand in view: your
 * score big, the round standings, and in match mode the running totals.
 */
export function RoundEnd({
  view,
  result,
  layout,
}: {
  view: CambioPlayerView;
  result: RoundResult;
  layout: PhoneLayout;
}) {
  const reduced = useReducedMotion();
  const mine = useRef<HTMLTableRowElement>(null);
  // On a big table the list scrolls; keep your own row in view.
  useEffect(() => {
    // Braces matter: newer browsers return a promise here, which must not become the cleanup.
    void mine.current?.scrollIntoView?.({ block: 'nearest' });
  }, [result.round]);
  const me = view.you?.id ?? '';
  const name = (id: string) =>
    id === me ? theme.phone.you : (view.players.find((p) => p.id === id)?.name ?? id);
  const match = view.options.scoringMode === 'match';
  const winners = new Set(view.winners ?? result.winners);
  const order = view.players.map((p) => p.id);
  const rows = [...order].sort(
    (a, b) =>
      (match ? (result.totals[a] ?? 0) - (result.totals[b] ?? 0) : 0) ||
      (result.scores[a] ?? 0) - (result.scores[b] ?? 0) ||
      order.indexOf(a) - order.indexOf(b),
  );
  const headline = view.winners
    ? theme.results.gameWinner(view.winners.map(name))
    : theme.results.roundWinner(result.winners.map(name));
  const top = layout.regions.strip.bottom + 6;
  const bottom = layout.height - layout.regions.hand.top + 6;

  return (
    <motion.section
      aria-label={theme.phone.standings}
      data-testid="round-end"
      initial={reduced ? false : { y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.28, ease: ease.outQuint }}
      className="absolute inset-x-3 z-[100] flex flex-col overflow-hidden rounded-[20px] font-card text-cambio-chalk"
      style={{
        top,
        bottom,
        background: '#06201a',
        boxShadow: '0 0 0 1px rgba(233,239,233,.1), 0 18px 40px -16px rgba(0,0,0,.8)',
      }}
    >
      <div className="flex items-end justify-between gap-3 px-4 pb-2 pt-3">
        <div className="min-w-0">
          <p className="text-sm text-cambio-chalkDim">{theme.phone.yourScore}</p>
          <p className="text-4xl font-extrabold leading-none tracking-[-0.03em] tabular-nums [font-stretch:110%]">
            {result.scores[me] ?? 0}
          </p>
        </div>
        <p className="min-w-0 pb-1 text-right text-base font-semibold leading-snug [text-wrap:balance]">
          {headline}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        <table className="w-full border-separate border-spacing-y-0.5 text-sm">
          <thead className="sr-only">
            <tr>
              <th>{theme.phone.standings}</th>
              <th>{theme.phone.yourScore}</th>
              {match && <th>{theme.phone.total}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((id) => {
              const win = winners.has(id);
              return (
                <tr
                  key={id}
                  ref={id === me ? mine : undefined}
                  data-testid={`standing-${id}`}
                  style={{ background: id === me ? 'rgba(242,210,122,.12)' : undefined }}
                >
                  <td className="truncate rounded-l-[10px] py-1 pl-2 font-semibold">
                    <span style={{ color: win ? colors.glow : undefined }}>{name(id)}</span>
                    {result.callerId === id && (
                      <span className="ml-1.5 text-xs text-cambio-chalkDim">
                        {theme.phone.caller}
                      </span>
                    )}
                  </td>
                  <td className="w-16 py-1 pr-2 text-right tabular-nums">
                    {result.scores[id] ?? 0}
                  </td>
                  {match && (
                    <td className="w-20 rounded-r-[10px] py-1 pr-2 text-right font-semibold tabular-nums text-cambio-chalkDim">
                      <span className="sr-only">{theme.phone.total} </span>
                      {result.totals[id] ?? 0}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {match && (
          <p className="px-2 pt-1 text-xs text-cambio-chalkDim">
            {theme.phone.totals} · {theme.options.matchTarget.label} {view.options.matchTarget}
          </p>
        )}
      </div>
    </motion.section>
  );
}
