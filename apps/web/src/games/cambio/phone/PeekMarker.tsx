import { theme, type CambioPlayerView } from '@partybox/cambio';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import { posesFor, type PhoneLayout } from '../motion/layout';
import type { MotionFrame } from '../motion/useCambioMotion';
import { CARD_RATIO, colors, ease } from '../tokens';
import { EyeIcon } from './ui';

/**
 * While someone else peeks at a card, an eye on that card and who is looking. It follows the
 * public scene (the peek event, then the peeker's turn), so it shows the same moment the TV
 * does. It never draws a face: the card under it stays face down.
 */
export function PeekMarker({
  view,
  layout,
  frame,
}: {
  view: CambioPlayerView;
  layout: PhoneLayout;
  frame: MotionFrame;
}) {
  const reduced = useReducedMotion();
  const me = view.you?.id;
  const { scene } = frame;
  const peek = scene.peek;
  const target = useMemo(() => {
    if (!peek || peek.playerId === me) return null;
    for (const seat of scene.seats) {
      const slot = seat.slots.find((s) => s.slotId === peek.slotId);
      if (!slot) continue;
      const pose = posesFor(scene, layout).get(slot.cardId);
      return pose ? { cardId: slot.cardId, ownerId: seat.playerId, pose } : null;
    }
    return null;
  }, [peek, me, scene, layout]);
  const peeker = peek ? view.players.find((p) => p.id === peek.playerId)?.name : undefined;

  return (
    <AnimatePresence>
      {target && peek && peeker && (
        <PeekBadge
          key={`${peek.playerId}:${target.cardId}`}
          cardId={target.cardId}
          peekerId={peek.playerId}
          text={theme.phone.peekedBy(peeker)}
          x={target.pose.x}
          y={target.pose.y}
          w={target.pose.scale * layout.spriteWidth}
          above={target.ownerId === me}
          screenW={layout.width}
          reduced={!!reduced}
        />
      )}
    </AnimatePresence>
  );
}

function PeekBadge({
  cardId,
  peekerId,
  text,
  x,
  y,
  w,
  above,
  screenW,
  reduced,
}: {
  cardId: string;
  peekerId: string;
  text: string;
  x: number;
  y: number;
  w: number;
  /** Your own card: the caption goes above it, clear of the action bar. */
  above: boolean;
  screenW: number;
  reduced: boolean;
}) {
  const h = w * CARD_RATIO;
  const eye = Math.max(18, Math.min(26, w * 0.6));
  const captionW = 150;
  const left = Math.min(Math.max(x - captionW / 2, 8), screenW - captionW - 8);
  return (
    <motion.div
      role="status"
      data-testid="peek-marker"
      data-card-id={cardId}
      data-peeker={peekerId}
      className="pointer-events-none absolute inset-0 z-[96]"
      initial={reduced ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.12 } }}
      transition={{ duration: 0.15, ease: ease.outCubic }}
      style={{ transformOrigin: `${x}px ${y}px` }}
    >
      <span
        aria-hidden="true"
        className="absolute grid place-items-center rounded-full"
        style={{
          left: x + w / 2 - eye * 0.6,
          top: y - h / 2 - eye * 0.4,
          width: eye,
          height: eye,
          background: colors.glow,
          color: colors.ink,
          boxShadow: '0 0 0 2px rgba(11,52,40,.9), 0 4px 10px -3px rgba(0,0,0,.6)',
        }}
      >
        <EyeIcon size={Math.round(eye * 0.62)} />
      </span>
      <span
        className="absolute flex justify-center"
        style={{ left, width: captionW, top: above ? y - h / 2 - 30 : y + h / 2 + 6 }}
      >
        <span
          className="truncate rounded-full px-2 py-0.5 font-card text-[12px] font-semibold leading-4"
          style={{
            color: colors.ink,
            background: colors.glow,
            boxShadow: '0 6px 14px -6px rgba(0,0,0,.7)',
          }}
        >
          {text}
        </span>
      </span>
    </motion.div>
  );
}
