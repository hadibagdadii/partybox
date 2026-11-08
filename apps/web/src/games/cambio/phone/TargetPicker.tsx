import { theme, type CambioPlayerView, type Face } from '@partybox/cambio';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { Card } from '../cards/Card';
import { gridCell, handCols } from '../motion/layout';
import { colors, ease } from '../tokens';

const MINI = 44;

/**
 * Every player's cards as small face-down slots, grouped by player, on each hand's stable grid
 * (holes stay empty). Scrolls when a big table runs long. Only the slots `enabled` allows can be
 * pressed; the rest are greyed out. A peeked card shows its face here, and only here.
 */
export function TargetPicker({
  view,
  title,
  playerIds,
  enabled,
  onPick,
  picked,
  faces,
  children,
}: {
  view: CambioPlayerView;
  title: string;
  /** Whose cards to show, in seat order. */
  playerIds: string[];
  enabled: (slotId: string) => boolean;
  onPick: (slotId: string) => void;
  /** Slots already picked (the first card of a blind swap, the peeked card). */
  picked: Set<string>;
  /** Faces this player may see right now, by slot id. */
  faces: Record<string, Face>;
  /** Buttons under the grid: Skip, Keep, Done, Cancel. */
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const me = view.you?.id;
  const shown = new Set(playerIds);
  return (
    <motion.section
      role="dialog"
      aria-label={title}
      initial={reduced ? false : { y: 24, opacity: 0.6 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: ease.outQuint }}
      className="pb-safe absolute inset-x-0 bottom-0 z-[120] flex max-h-[64%] flex-col rounded-t-[22px] font-card text-cambio-chalk"
      style={{
        background: '#06201a',
        boxShadow: '0 -1px 0 rgba(233,239,233,.12), 0 -18px 40px -12px rgba(0,0,0,.7)',
      }}
    >
      <h2 className="px-4 pb-2 pt-4 text-lg font-semibold leading-snug [text-wrap:balance]">
        {title}
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          {view.players
            .filter((p) => shown.has(p.id))
            .map((p) => {
              const cols = handCols(p.slots.map((s) => s.pos));
              const name = p.id === me ? theme.phone.you : p.name;
              return (
                <div key={p.id} data-testid={`group-${p.id}`} className="min-w-0">
                  <p className="mb-1.5 truncate text-sm font-semibold text-cambio-chalkDim">
                    {name}
                    {view.lockedPlayerId === p.id && ` · ${theme.phone.locked}`}
                  </p>
                  <div
                    className="grid w-max gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${cols}, ${MINI}px)` }}
                  >
                    {p.slots.map((s) => {
                      const { col, row } = gridCell(s.pos);
                      const ok = enabled(s.slotId);
                      const face = faces[s.slotId] ?? null;
                      const isPicked = picked.has(s.slotId);
                      return (
                        <button
                          key={s.slotId}
                          type="button"
                          data-slot={s.slotId}
                          disabled={!ok}
                          aria-pressed={isPicked}
                          aria-label={
                            p.id === me
                              ? theme.phone.yourCard(s.pos + 1)
                              : theme.phone.theirCard(p.name, s.pos + 1)
                          }
                          onClick={() => onPick(s.slotId)}
                          className={`no-callout rounded-[6px] transition-[transform,opacity,filter] duration-150 ease-out active:scale-[0.94] motion-reduce:transition-none ${isPicked ? '' : 'disabled:opacity-30 disabled:grayscale'}`}
                          style={{
                            gridColumn: col + 1,
                            gridRow: row + 1,
                            boxShadow: isPicked ? `0 0 0 3px ${colors.glow}` : undefined,
                          }}
                        >
                          <Card face={face} faceUp={!!face} size={MINI} lifted={isPicked} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
      {children && <div className="flex gap-2 px-4 pb-4 pt-1">{children}</div>}
    </motion.section>
  );
}
