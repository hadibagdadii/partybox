import { theme, type CambioHostView, type NameOf, type RoundResult } from '@partybox/cambio';
import { motion } from 'motion/react';
import { colors, ease } from '../tokens';
import { matchLeaders } from './geometry';

/**
 * After the reveal: the round's (or the match's) standings in the middle of the table. In match
 * mode it shows the round score and running total, the target, who leads and who's closest to
 * ending it. The seats keep their own scores on their plates around it.
 */
export function Standings({
  view,
  result,
  name,
  reduced,
}: {
  view: CambioHostView;
  result: RoundResult;
  name: NameOf;
  reduced: boolean;
}) {
  const match = view.options.scoringMode === 'match';
  const over = view.phase === 'over';
  const order = view.players.map((p) => p.id);
  const winners = new Set(view.winners ?? result.winners);
  const rows = [...order].sort(
    (a, b) =>
      (match ? (result.totals[a] ?? 0) - (result.totals[b] ?? 0) : 0) ||
      (result.scores[a] ?? 0) - (result.scores[b] ?? 0) ||
      order.indexOf(a) - order.indexOf(b),
  );
  const headline = view.winners
    ? theme.results.gameWinner(view.winners.map(name))
    : theme.results.roundWinner(result.winners.map(name));
  const { leaders, closest } = matchLeaders(result.totals, order);
  const big = rows.length > 8;
  const rowH = big ? 40 : 50;
  const font = big ? 26 : 30;

  return (
    <motion.section
      aria-label={match ? theme.tv.matchStandings : theme.tv.standings(result.round)}
      data-testid="standings"
      data-over={over ? '' : undefined}
      className="absolute left-1/2 top-1/2 flex w-[760px] flex-col rounded-[32px] px-9 pb-6 pt-7 font-card text-cambio-chalk"
      style={{
        x: '-50%',
        y: '-50%',
        background: 'rgba(5,24,18,.94)',
        boxShadow: `0 0 0 1px rgba(233,239,233,.08), 0 0 0 10px ${colors.rail}, 0 40px 90px -30px rgba(0,0,0,.9)`,
        zIndex: 110,
      }}
      initial={reduced ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: ease.outQuint }}
    >
      <h2
        className="font-extrabold leading-[1.05] tracking-[-0.02em] [font-stretch:110%] [text-wrap:balance]"
        style={{ fontSize: big ? 44 : 52, color: colors.glow }}
      >
        {headline}
      </h2>
      <table className="mt-5 w-full border-separate border-spacing-y-1" style={{ fontSize: font }}>
        <thead>
          <tr className="text-left" style={{ color: colors.chalkDim, fontSize: font * 0.7 }}>
            <th className="font-semibold">
              <span className="sr-only">{theme.tv.standings(result.round)}</span>
            </th>
            <th className="w-28 pr-3 text-right font-semibold">{theme.tv.round}</th>
            {match && <th className="w-28 pr-3 text-right font-semibold">{theme.tv.total}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((id, i) => {
            const win = winners.has(id);
            return (
              <motion.tr
                key={id}
                data-testid={`standing-${id}`}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.24,
                  ease: ease.outCubic,
                  delay: reduced ? 0 : 0.12 + i * 0.04,
                }}
                style={{ height: rowH, background: win ? 'rgba(242,210,122,.14)' : undefined }}
              >
                <td className="max-w-0 rounded-l-[14px] pl-4 font-semibold">
                  <span className="flex items-center gap-3">
                    <span className="truncate" style={{ color: win ? colors.glow : undefined }}>
                      {name(id)}
                    </span>
                    {result.callerId === id && (
                      <span
                        className="shrink-0 rounded-full px-3 py-0.5 font-semibold"
                        style={{
                          fontSize: font * 0.62,
                          background: colors.brass,
                          color: colors.ink,
                        }}
                      >
                        {theme.tv.caller}
                      </span>
                    )}
                  </span>
                </td>
                <td
                  className={`pr-3 text-right tabular-nums ${match ? '' : 'rounded-r-[14px]'}`}
                  style={{ fontWeight: match ? 500 : 800 }}
                >
                  {result.scores[id] ?? 0}
                </td>
                {match && (
                  <td className="rounded-r-[14px] pr-3 text-right font-extrabold tabular-nums">
                    {result.totals[id] ?? 0}
                  </td>
                )}
              </motion.tr>
            );
          })}
        </tbody>
      </table>
      {match && (
        <p
          data-testid="match-line"
          className="mt-4 [text-wrap:balance]"
          style={{ fontSize: 26, color: colors.chalkDim }}
        >
          {theme.tv.playingTo(view.options.matchTarget)}
          {!over && closest && (
            <>
              {' · '}
              <span style={{ color: colors.chalk }}>{theme.tv.leading(leaders.map(name))}</span>
              {' · '}
              {theme.tv.closestTo(name(closest), view.options.matchTarget)}
            </>
          )}
        </p>
      )}
      {view.phase === 'roundOver' && (
        <p className="mt-3" style={{ fontSize: 24, color: colors.chalkDim }}>
          {theme.tv.waitingForVip}
        </p>
      )}
    </motion.section>
  );
}
