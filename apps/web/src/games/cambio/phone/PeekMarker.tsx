import { theme } from '@partybox/cambio';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import { posesFor, type TableLayout } from '../motion/layout';
import type { MotionFrame } from '../motion/useCambioMotion';
import { CARD_RATIO, colors, ease } from '../tokens';
import { EyeIcon } from './ui';

/** Marker sizes: a phone held in the hand, or a TV read from across the room. */
const SIZES = {
  phone: { eyeMin: 18, eyeMax: 26, captionW: 150, font: 12, line: 16, gap: 6 },
  tv: { eyeMin: 52, eyeMax: 64, captionW: 460, font: 30, line: 38, gap: 12 },
} as const;

/**
 * While someone else peeks at a card, an eye on that card and who is looking. It follows the
 * public scene (the peek event, then the peeker's turn), so the phone and the TV show the same
 * moment. It never draws a face: the card under it stays face down.
 */
export function PeekMarker({
  players,
  viewerId,
  layout,
  frame,
  size = 'phone',
}: {
  players: readonly { id: string; name: string }[];
  /** Your own peeks get no marker; the TV passes null, so every peek is marked. */
  viewerId: string | null;
  layout: TableLayout;
  frame: MotionFrame;
  size?: keyof typeof SIZES;
}) {
  const reduced = useReducedMotion();
  const me = viewerId;
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
  const peeker = peek ? players.find((p) => p.id === peek.playerId)?.name : undefined;

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
          above={size === 'tv' ? target.pose.y > layout.height / 2 : target.ownerId === me}
          screenW={layout.width}
          reduced={!!reduced}
          dims={SIZES[size]}
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
  dims,
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
  dims: (typeof SIZES)[keyof typeof SIZES];
}) {
  const h = w * CARD_RATIO;
  const eye = Math.max(dims.eyeMin, Math.min(dims.eyeMax, w * 0.6));
  const captionW = dims.captionW;
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
        style={{
          left,
          width: captionW,
          top: above ? y - h / 2 - dims.line - dims.gap * 2 : y + h / 2 + dims.gap,
        }}
      >
        <span
          className="truncate rounded-full font-card font-semibold"
          style={{
            fontSize: dims.font,
            lineHeight: `${dims.line}px`,
            padding: `${dims.line * 0.06}px ${dims.font * 0.6}px`,
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
