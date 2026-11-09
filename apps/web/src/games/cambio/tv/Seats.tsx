import { theme, type CambioHostView } from '@partybox/cambio';
import { motion } from 'motion/react';
import type { TvLayout, TvSeat } from '../motion/layout';
import type { MotionFrame } from '../motion/useCambioMotion';
import { LockIcon } from '../phone/ui';
import { colors, ease } from '../tokens';
import { handBox } from './geometry';
import type { Tally } from './useRevealTally';

const BRASS_GLOW = 'rgba(242,210,122,';

/**
 * Under the cards: a soft brass halo behind the hand whose turn it is, breathing slowly, and a
 * steady ring around the winners once the round is revealed.
 */
export function SeatGlows({
  layout,
  frame,
  turnId,
  winners,
  reduced,
}: {
  layout: TvLayout;
  frame: MotionFrame;
  turnId: string | null;
  winners: ReadonlySet<string>;
  reduced: boolean;
}) {
  return (
    <>
      {frame.scene.seats.map((seat) => {
        const turn = seat.playerId === turnId;
        const won = winners.has(seat.playerId);
        if (!turn && !won) return null;
        const box = handBox(layout, seat);
        if (!box) return null;
        const pad = layout.cardW * 0.2;
        return (
          <motion.div
            key={`${seat.playerId}:${turn ? 'turn' : 'won'}`}
            data-testid={turn ? 'turn-glow' : 'winner-ring'}
            data-player={seat.playerId}
            aria-hidden="true"
            initial={reduced ? false : { opacity: 0 }}
            animate={turn && !reduced ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
            transition={
              turn && !reduced
                ? { duration: 2.2, ease: 'easeInOut', repeat: Infinity }
                : { duration: 0.3, ease: ease.outCubic }
            }
            style={{
              position: 'absolute',
              left: box.x - pad,
              top: box.y - pad,
              width: box.w + pad * 2,
              height: box.h + pad * 2,
              borderRadius: layout.cardW * 0.28,
              background: turn
                ? `radial-gradient(ellipse at center, ${BRASS_GLOW}.34) 0%, ${BRASS_GLOW}.12) 55%, transparent 75%)`
                : undefined,
              boxShadow: won
                ? `0 0 0 4px ${colors.glow}, 0 0 36px 6px ${BRASS_GLOW}.35)`
                : `0 0 0 2px ${BRASS_GLOW}.55), 0 0 48px 8px ${BRASS_GLOW}.22)`,
              zIndex: 2,
            }}
          />
        );
      })}
    </>
  );
}

type Chip = { key: string; text: string; tone: 'dim' | 'brass' | 'danger' | 'score' };

function chipsFor(
  seat: TvSeat,
  view: CambioHostView,
  callerId: string | null,
  away: ReadonlySet<string>,
  tally: Tally,
): Chip[] {
  const id = seat.playerId;
  const out: Chip[] = [];
  const score = tally.totals[id];
  if (score !== undefined) out.push({ key: 'score', text: String(score), tone: 'score' });
  if (away.has(id)) out.push({ key: 'away', text: theme.tv.away, tone: 'danger' });
  // Once scores show, the standings name the caller; the plate keeps room for the name.
  if (callerId === id && score === undefined)
    out.push({ key: 'called', text: theme.tv.caller, tone: 'brass' });
  if (view.phase === 'peek' && view.readyIds.includes(id))
    out.push({ key: 'ready', text: `✓ ${theme.tv.ready}`, tone: 'dim' });
  return out;
}

const chipStyle = (tone: Chip['tone']) =>
  tone === 'danger'
    ? { background: colors.danger, color: 'white' }
    : tone === 'brass'
      ? { background: colors.brass, color: colors.ink }
      : tone === 'score'
        ? { background: colors.stock, color: colors.ink }
        : { background: 'rgba(233,239,233,.14)', color: colors.chalk };

/**
 * Over the cards: each seat's name plate on the outer side of the table, with what's going on
 * with them (their score as it counts up, away, the caller, ready), and the caller's lock on the
 * corner of their hand.
 */
export function SeatPlates({
  layout,
  view,
  frame,
  turnId,
  winners,
  away,
  tally,
}: {
  layout: TvLayout;
  view: CambioHostView;
  frame: MotionFrame;
  turnId: string | null;
  winners: ReadonlySet<string>;
  away: ReadonlySet<string>;
  tally: Tally;
}) {
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  const callerId = frame.scene.callerId;
  const locked = view.lockedPlayerId && view.lockedPlayerId === callerId ? callerId : null;
  return (
    <>
      {layout.seats.map((seat) => {
        const turn = seat.playerId === turnId;
        const won = winners.has(seat.playerId);
        const chips = chipsFor(seat, view, callerId, away, tally);
        const font = Math.round(seat.plateH * 0.6);
        const sceneSeat = frame.scene.seats.find((s) => s.playerId === seat.playerId);
        const hand = sceneSeat ? handBox(layout, sceneSeat) : null;
        const badge = Math.round(layout.cardW * 0.5);
        return (
          <div key={seat.playerId}>
            <div
              data-testid={`seat-${seat.playerId}`}
              data-turn={turn ? '' : undefined}
              className="absolute flex items-center justify-center gap-[0.35em] font-card"
              style={{
                left: seat.labelX - seat.plateW / 2,
                top: seat.labelY - seat.plateH / 2,
                width: seat.plateW,
                height: seat.plateH,
                fontSize: font,
                zIndex: 80,
              }}
            >
              <span
                className="min-w-[3.5em] truncate rounded-full font-semibold leading-none [font-stretch:88%]"
                style={{
                  padding: `${font * 0.2}px ${font * 0.55}px`,
                  color: turn || won ? colors.ink : colors.chalk,
                  background: turn || won ? colors.glow : 'rgba(4,20,15,.72)',
                  boxShadow: '0 1px 2px rgba(0,0,0,.4), 0 6px 14px -8px rgba(0,0,0,.6)',
                  transition: 'background-color 200ms ease, color 200ms ease',
                }}
              >
                {names.get(seat.playerId) ?? seat.playerId}
              </span>
              {chips.map((c) => (
                <span
                  key={c.key}
                  data-testid={
                    c.key === 'score' ? (tally.counting ? 'reveal-tally' : 'score') : undefined
                  }
                  className="shrink-0 rounded-full font-bold leading-none tabular-nums"
                  style={{
                    ...chipStyle(c.tone),
                    fontSize: c.tone === 'score' ? font : font * 0.72,
                    padding: `${font * 0.2}px ${font * 0.45}px`,
                    fontStretch: c.tone === 'score' ? '115%' : '90%',
                  }}
                >
                  {c.text}
                </span>
              ))}
            </div>
            {locked === seat.playerId && hand && (
              <span
                data-testid="lock-badge"
                role="img"
                aria-label={theme.tv.locked}
                className="absolute grid place-items-center rounded-full"
                style={{
                  left: hand.x + hand.w - badge * 0.6,
                  top: hand.y - badge * 0.4,
                  width: badge,
                  height: badge,
                  background: colors.brass,
                  color: colors.ink,
                  boxShadow: `0 0 0 3px ${colors.feltDeep}, 0 6px 14px -4px rgba(0,0,0,.6)`,
                  zIndex: 81,
                }}
              >
                <LockIcon size={Math.round(badge * 0.55)} />
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
