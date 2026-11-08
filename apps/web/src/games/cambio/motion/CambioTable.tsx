import type { CambioHostView } from '@partybox/cambio';
import { motion } from 'motion/react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { colors, ease, fonts } from '../tokens';
import { CardLayer, type Perspective } from './CardLayer';
import { Felt } from './Felt';
import { phoneLayout, tableLayout, type TableLayout } from './layout';
import { DeckStack, DiscardBase, ImpactRing, SweepGhosts } from './Piles';
import type { MotionFrame } from './useCambioMotion';

/** Measures the element on mount and on resize only; animation frames never read layout. */
function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
}

function SeatPlates({
  layout,
  view,
  frame,
}: {
  layout: TableLayout;
  view: CambioHostView;
  frame: MotionFrame;
}) {
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  const pulse = frame.playing?.step.effects.find((e) => e.kind === 'seatPulse');
  return (
    <>
      {layout.seats.map((seat) => {
        const turn = view.turn?.playerId === seat.playerId;
        const caller = frame.scene.callerId === seat.playerId;
        const pulsing = pulse?.kind === 'seatPulse' && pulse.playerId === seat.playerId;
        const fontSize = Math.max(12, Math.min(22, seat.cardWidth * 0.32));
        return (
          <motion.div
            key={pulsing ? `${seat.playerId}-${frame.playing!.id}` : seat.playerId}
            initial={false}
            animate={pulsing ? { scale: [1, 1.18, 1] } : { scale: 1 }}
            transition={{ duration: 0.42 * frame.timeScale, ease: ease.outCubic }}
            style={{
              position: 'absolute',
              left: seat.labelX,
              top: seat.labelY,
              translateX: '-50%',
              translateY: '-50%',
              padding: `${fontSize * 0.2}px ${fontSize * 0.6}px`,
              borderRadius: 999,
              fontFamily: fonts.card.join(', '),
              fontWeight: 600,
              fontSize,
              fontStretch: '90%',
              whiteSpace: 'nowrap',
              color: turn ? colors.ink : colors.chalk,
              background: turn ? colors.glow : 'rgba(5,24,18,.55)',
              boxShadow: caller ? `0 0 0 2px ${colors.glow}` : '0 1px 2px rgba(0,0,0,.3)',
              zIndex: 4,
            }}
          >
            {names.get(seat.playerId) ?? seat.playerId}
          </motion.div>
        );
      })}
    </>
  );
}

/**
 * The animated card table: felt, piles, name plates, and every card. `phoneOf` draws a phone's
 * portrait layout for that player instead of the TV's round table.
 */
export function CambioTable({
  view,
  frame,
  perspective,
  phoneOf,
  className,
}: {
  view: CambioHostView;
  frame: MotionFrame;
  perspective?: Perspective;
  phoneOf?: string;
  className?: string;
}) {
  const { ref, size } = useSize();
  const ids = useMemo(() => view.players.map((p) => p.id), [view.players]);
  const layout = useMemo(() => {
    if (!size || size.w === 0) return null;
    return phoneOf ? phoneLayout(size.w, size.h, ids, phoneOf) : tableLayout(size.w, size.h, ids);
  }, [size, ids, phoneOf]);
  const { scene, playing, timeScale } = frame;

  return (
    <Felt className={className} style={{ width: '100%', height: '100%' }}>
      <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
        {layout && (
          <CardLayer
            scene={scene}
            playing={playing}
            highlight={frame.highlight}
            layout={layout}
            perspective={perspective}
            reduced={frame.reduced}
            timeScale={timeScale}
            under={
              <>
                <DeckStack layout={layout} count={scene.deckCount} />
                <DiscardBase layout={layout} count={scene.discardCount} playing={playing} />
                <ImpactRing layout={layout} playing={playing} timeScale={timeScale} />
                <SeatPlates layout={layout} view={view} frame={frame} />
              </>
            }
            over={<SweepGhosts layout={layout} playing={playing} timeScale={timeScale} />}
          />
        )}
      </div>
    </Felt>
  );
}
