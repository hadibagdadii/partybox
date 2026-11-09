import { theme, type CambioPlayerView } from '@partybox/cambio';
import { motion, useReducedMotion } from 'motion/react';
import type { PhoneLayout } from '../motion/layout';
import type { MotionFrame } from '../motion/useCambioMotion';
import { colors, ease } from '../tokens';
import { LockIcon } from './ui';

/**
 * Labels for the other players' mini hands along the top: name, a ring on whoever's turn it
 * is, and a lock once they call Cambio. The cards themselves are drawn by the card layer on
 * the same boxes, so every move, peek, and snap is visible here. Nothing in this overlay
 * takes touches.
 */
export function MiniHands({
  view,
  layout,
  frame,
}: {
  view: CambioPlayerView;
  layout: PhoneLayout;
  frame: MotionFrame;
}) {
  const reduced = useReducedMotion();
  const ready = new Set(view.readyIds);
  const pulse = frame.playing?.step.effects.find((e) => e.kind === 'seatPulse');
  // The badge appears with the call as it plays, not before the motion catches up.
  const caller = frame.scene.callerId;
  return (
    <ul
      aria-label="Players"
      data-testid="mini-hands"
      className="pointer-events-none absolute inset-0 z-[90] m-0 list-none p-0"
    >
      {layout.regions.strip.hands.map((box) => {
        const p = view.players.find((x) => x.id === box.playerId);
        if (!p) return null;
        const turn = view.phase === 'play' && view.turn?.playerId === p.id;
        const called = caller === p.id;
        const locked = view.lockedPlayerId === p.id;
        const waiting = view.phase === 'peek' && !ready.has(p.id);
        const pulsing = pulse?.kind === 'seatPulse' && pulse.playerId === p.id;
        return (
          <li
            key={p.id}
            data-testid={`mini-${p.id}`}
            data-row={box.row}
            data-turn={turn ? '' : undefined}
            aria-label={theme.phone.miniHand(p.name, p.slots.length, turn)}
            className="absolute"
            style={{
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              opacity: waiting ? 0.6 : 1,
              transition: 'opacity 200ms ease',
            }}
          >
            {/* The turn ring: under the cards' edge, fades in and out with the turn. */}
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-[9px] transition-opacity duration-200 ease-out motion-reduce:transition-none"
              style={{
                opacity: turn ? 1 : 0,
                boxShadow: `0 0 0 2px ${colors.glow}, 0 0 14px -2px rgba(242,210,122,.55)`,
                background: 'rgba(242,210,122,.07)',
              }}
            />
            {/* The name may use half the gap on each side: at the smallest size a two-column
                hand is only 44 px wide. */}
            <span
              className="relative -mx-[3px] flex h-4 items-center justify-center font-card text-[12px] font-semibold leading-4"
              style={{ color: turn ? colors.glow : colors.chalk }}
            >
              <span className="truncate">{p.name}</span>
            </span>
            {/* The lock sits on the hand's corner, like a badge, so it never squeezes the name. */}
            {called && (
              <motion.span
                key={pulsing ? `pulse-${frame.playing!.id}` : 'badge'}
                data-testid={`lock-${p.id}`}
                aria-label={locked ? theme.phone.locked : theme.phone.caller}
                role="img"
                className="absolute -right-1.5 top-2.5 z-[1] grid place-items-center rounded-full"
                style={{
                  width: 14,
                  height: 14,
                  background: colors.danger,
                  color: 'white',
                  boxShadow: '0 0 0 1.5px rgba(11,52,40,.9)',
                }}
                initial={reduced || !pulsing ? false : { scale: 0.6 }}
                animate={reduced || !pulsing ? { scale: 1 } : { scale: [0.6, 1.25, 1] }}
                transition={{ duration: 0.42 * frame.timeScale, ease: ease.outCubic }}
              >
                <LockIcon size={9} />
              </motion.span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
