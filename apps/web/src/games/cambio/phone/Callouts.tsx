import type { Face } from '@partybox/cambio';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Card } from '../cards/Card';
import type { PhoneLayout } from '../motion/layout';
import { colors, ease } from '../tokens';

/** Who called Cambio and how many turns are left, pinned under the strip. */
export function CambioBanner({
  layout,
  text,
  turns,
}: {
  layout: PhoneLayout;
  text: string | null;
  turns: string;
}) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {text && (
        <motion.p
          key="banner"
          role="status"
          initial={reduced ? false : { y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -6, opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.24, ease: ease.outQuint }}
          className="pointer-events-none absolute inset-x-3 z-[95] flex h-8 items-center justify-center gap-2 rounded-full font-card text-sm font-semibold"
          style={{
            top: layout.regions.bannerY - 16,
            background: colors.danger,
            color: 'white',
            boxShadow: '0 6px 14px -6px rgba(0,0,0,.6)',
          }}
        >
          <span className="truncate">{text}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0 tabular-nums">{turns}</span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export type Notice =
  | { kind: 'wrong'; key: number; text: string; face: Face }
  | { kind: 'tooLate'; key: number; text: string };

type WithoutKey<T> = T extends unknown ? Omit<T, 'key'> : never;
export type NoticeInput = WithoutKey<Notice>;

/**
 * A short message by the discard pile: a wrong snap shows the card everyone saw; a snap that
 * arrived too late just says so. Nothing here ever shows a face the player may not see.
 */
export function SnapNotice({ layout, notice }: { layout: PhoneLayout; notice: Notice | null }) {
  const reduced = useReducedMotion();
  const pile = layout.discard;
  const pileH = pile.scale * layout.spriteWidth * 1.4;
  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          key={notice.key}
          role="alert"
          data-testid={notice.kind === 'wrong' ? 'wrong-snap' : 'too-late'}
          initial={reduced ? false : { scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ duration: 0.2, ease: ease.outQuint }}
          className="pointer-events-none absolute z-[110] flex items-center gap-2 rounded-[14px] px-3 py-2 font-card text-sm font-semibold"
          style={{
            left: 12,
            right: 12,
            top: pile.y + pileH / 2 + 6,
            justifyContent: 'center',
            color: notice.kind === 'wrong' ? 'white' : colors.ink,
            background: notice.kind === 'wrong' ? colors.danger : colors.glow,
            boxShadow: '0 8px 18px -8px rgba(0,0,0,.7)',
          }}
        >
          {notice.kind === 'wrong' && <Card face={notice.face} faceUp size={30} />}
          <span>{notice.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** One line of guidance above the action bar. */
export function Hint({ text }: { text: string }) {
  return (
    <p
      aria-live="polite"
      className="min-h-5 truncate text-center font-card text-sm text-cambio-chalkDim [text-wrap:balance]"
    >
      {text}
    </p>
  );
}
