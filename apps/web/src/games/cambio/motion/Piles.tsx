import { motion } from 'motion/react';
import { CardBack } from '../cards/CardBack';
import { CARD_RATIO, colors, ease } from '../tokens';
import type { Pose, TableLayout } from './layout';
import type { Playing } from './queue';

const RADIUS = '7% / 5%';

/** Where a pose's card sits, as a plain absolutely positioned box. */
function box(p: Pose, sprite: number) {
  const w = sprite * p.scale;
  const h = w * CARD_RATIO;
  return { left: p.x - w / 2, top: p.y - h / 2, width: w, height: h };
}

/** The deck: stacked backs whose thickness follows the count. Static; drawn cards fly off its top. */
export function DeckStack({ layout, count }: { layout: TableLayout; count: number }) {
  const b = box(layout.deck, layout.spriteWidth);
  const layers = Math.min(6, Math.ceil(count / 9));
  return (
    <div aria-hidden="true" style={{ position: 'absolute', ...b, zIndex: 1 }}>
      {count === 0 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: RADIUS,
            border: `2px dashed ${colors.chalkDim}`,
            opacity: 0.5,
          }}
        />
      ) : (
        Array.from({ length: layers }, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translate(${(layers - 1 - i) * -1.2}px, ${(layers - 1 - i) * 1.4}px)`,
              borderRadius: RADIUS,
              overflow: 'hidden',
              boxShadow:
                i === 0 ? '0 2px 4px rgba(0,0,0,.35), 0 12px 20px -10px rgba(0,0,0,.5)' : undefined,
            }}
          >
            <CardBack />
          </div>
        ))
      )}
    </div>
  );
}

/** The discard pile's edge under the tracked top cards, so a deep pile looks deep. */
export function DiscardBase({
  layout,
  count,
  playing,
}: {
  layout: TableLayout;
  count: number;
  playing: Playing | null;
}) {
  const b = box(layout.discard, layout.spriteWidth);
  const depth = Math.min(5, Math.ceil(count / 8));
  const shake = playing?.step.effects.find((e) => e.kind === 'pileShake');
  const k = playing?.rate ?? 1;
  return (
    <motion.div
      aria-hidden="true"
      key={shake ? playing!.id : 'still'}
      initial={false}
      animate={shake ? { x: [0, -4, 4, -2, 0] } : { x: 0 }}
      transition={
        shake
          ? { duration: 0.26 * k, delay: (shake.delay * k) / 1000, ease: ease.inOutCubic }
          : { duration: 0 }
      }
      style={{ position: 'absolute', ...b, zIndex: 2 }}
    >
      {count > 1 &&
        Array.from({ length: depth }, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translate(${(i + 1) * 1.3}px, ${(i + 1) * 1.6}px) rotate(${(i % 2 ? 1 : -1) * (i + 1)}deg)`,
              borderRadius: RADIUS,
              background: colors.stockShade,
              boxShadow: '0 1px 2px rgba(0,0,0,.3)',
            }}
          />
        ))}
    </motion.div>
  );
}

/** Reshuffle: a run of backs sweeps from the discard into the deck. Card ids are not tracked. */
export function SweepGhosts({
  layout,
  playing,
  timeScale,
}: {
  layout: TableLayout;
  playing: Playing | null;
  timeScale: number;
}) {
  const sweep = playing?.step.effects.find((e) => e.kind === 'sweep');
  if (!sweep || sweep.kind !== 'sweep' || sweep.count === 0) return null;
  const k = playing!.rate * timeScale;
  const from = layout.discard;
  const to = layout.deck;
  const b = box(from, layout.spriteWidth);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const total = (sweep.duration * k) / 1000;
  const each = total / 1.6;
  const stagger = (total - each) / sweep.count;
  return (
    <div
      aria-hidden="true"
      key={playing!.id}
      style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none' }}
    >
      {Array.from({ length: sweep.count }, (_, i) => (
        <motion.div
          key={i}
          initial={{ x: i * 1.5, y: -i * 1.5, rotate: (i % 3) - 1 }}
          animate={{
            x: [i * 1.5, dx / 2, dx],
            y: [-i * 1.5, dy / 2 - b.height * 0.25, dy],
            rotate: [(i % 3) - 1, -8, 0],
          }}
          transition={{ duration: each, delay: i * stagger, ease: ease.inOutCubic }}
          style={{
            position: 'absolute',
            ...b,
            borderRadius: RADIUS,
            overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0,0,0,.3)',
          }}
        >
          <CardBack />
        </motion.div>
      ))}
    </div>
  );
}

/**
 * A snap's impact: a ring bursts from under the discard as the card lands. It starts fully
 * visible but hidden behind the pile's top card, so nothing ever fades in from nothing.
 */
export function ImpactRing({
  layout,
  playing,
  timeScale,
}: {
  layout: TableLayout;
  playing: Playing | null;
  timeScale: number;
}) {
  const fx = playing?.step.effects.find((e) => e.kind === 'impact');
  if (!fx) return null;
  const k = playing!.rate * timeScale;
  const b = box(layout.discard, layout.spriteWidth);
  return (
    <motion.div
      aria-hidden="true"
      key={playing!.id}
      initial={{ scale: 0.9, opacity: 0.9 }}
      animate={{ scale: 1.55, opacity: 0 }}
      transition={{ duration: 0.42 * k, delay: (fx.delay * k) / 1000, ease: ease.outQuint }}
      style={{
        position: 'absolute',
        ...b,
        zIndex: 3,
        borderRadius: RADIUS,
        boxShadow: `0 0 0 3px ${colors.glow}, 0 0 24px 6px rgba(242,210,122,.45)`,
        pointerEvents: 'none',
      }}
    />
  );
}
