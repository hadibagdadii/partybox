import { theme, type Face } from '@partybox/cambio';
import { motion } from 'motion/react';
import { memo, type CSSProperties } from 'react';
import { CARD_RATIO, cardSizes, ease, shadows, timing, type CardSize } from '../tokens';
import { CardBack } from './CardBack';
import { CardFace } from './CardFace';

/** A staged flip: rotateY keyframes in degrees, where 0 shows the face and 180 the back. */
export interface FlipSpec {
  rotateY: number[];
  times?: number[];
  /** Seconds. */
  duration: number;
  delay?: number;
}

export interface CardProps {
  /** The printed face, if this viewer may see it. Never passed for a hidden card. */
  face: Face | null;
  faceUp: boolean;
  /** A preset or a width in px. */
  size?: CardSize | number;
  /** Raised off the table: the shadow spreads and drops. */
  lifted?: boolean;
  /** A staged flip running right now (e.g. a wrong snap: up, hold, back down). */
  flip?: FlipSpec | null;
  /** Multiplies the plain flip's length (the gallery's slow motion). */
  flipScale?: number;
  className?: string;
  style?: CSSProperties;
  /** Inside a labelled button: hidden from screen readers so nothing is read twice. */
  decorative?: boolean;
}

/** 7% of the width, as an elliptical percentage so corners stay round at 5:7. */
const RADIUS = `${7}% / ${(7 / CARD_RATIO).toFixed(2)}%`;
const side: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  borderRadius: RADIUS,
  overflow: 'hidden',
};

/**
 * The one card used everywhere: a face and a back that flip with a real 3D rotateY.
 * The face side is only in the DOM while the card is face up or mid-flip, so a face-down
 * card never carries its face.
 */
export const Card = memo(function Card({
  face,
  faceUp,
  size = 'hand',
  lifted = false,
  flip = null,
  flipScale = 1,
  className,
  style,
  decorative = false,
}: CardProps) {
  const width = typeof size === 'number' ? size : cardSizes[size];
  const showFace = face !== null && (faceUp || flip !== null);
  const label = faceUp && face ? theme.cardName(face) : theme.cards.faceDown;
  const rotateY = flip ? flip.rotateY : faceUp ? 0 : 180;
  const transition = flip
    ? { duration: flip.duration, delay: flip.delay ?? 0, times: flip.times, ease: ease.inOutCubic }
    : { duration: (timing.flip * flipScale) / 1000, ease: ease.inOutCubic };

  return (
    <div
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? 'true' : undefined}
      data-card=""
      data-face-up={faceUp ? '' : undefined}
      className={className}
      style={{
        position: 'relative',
        width,
        height: width * CARD_RATIO,
        perspective: width * 6,
        ...style,
      }}
    >
      {/* The shadow drops and spreads on lift with a plain, interruptible CSS transition: cheap
          to mount, since a deal mounts dozens of cards at once. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: RADIUS,
          boxShadow: lifted ? shadows.lift : shadows.rest,
          transform: lifted ? `translateY(${width * 0.08}px) scale(1.06)` : 'none',
          transition: `transform ${timing.peek}ms cubic-bezier(${ease.outQuint.join(',')})`,
        }}
      />
      <motion.div
        initial={flip ? { rotateY: flip.rotateY[0] } : false}
        animate={{ rotateY }}
        transition={transition}
        style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }}
      >
        {showFace && face && (
          <div style={side}>
            <CardFace face={face} />
          </div>
        )}
        <div style={{ ...side, transform: 'rotateY(180deg)' }}>
          <CardBack />
        </div>
      </motion.div>
    </div>
  );
});
