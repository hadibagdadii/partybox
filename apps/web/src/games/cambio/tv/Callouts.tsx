import { theme, type CambioHostView, type NameOf } from '@partybox/cambio';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { turnsLeft } from '../format';
import type { TvLayout } from '../motion/layout';
import type { Step, StepKind } from '../motion/steps';
import type { MotionFrame } from '../motion/useCambioMotion';
import { LockIcon } from '../phone/ui';
import { CARD_RATIO, colors, ease, timing } from '../tokens';

interface Shown {
  id: number;
  step: Step;
  /** Playback rate times slow motion, for the step's own timings. */
  k: number;
  /** How long it stays up, in ms. */
  for: number;
}

/**
 * The step of one of `kinds` that started most recently, held on screen for `holdMs` after the
 * step ends so the words stay up long enough to read.
 */
function useStepMoment(frame: MotionFrame, kinds: readonly StepKind[], holdMs: number) {
  const [shown, setShown] = useState<Shown | null>(null);
  const p = frame.playing;
  useEffect(() => {
    if (!p || !kinds.includes(p.step.kind)) return;
    const k = p.rate * frame.timeScale;
    setShown({ id: p.id, step: p.step, k, for: p.step.duration * k + holdMs * frame.timeScale });
    // `kinds` is a constant per caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, frame.timeScale, holdMs]);
  // Its own timer: the next step starting must not keep this one up.
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown((s) => (s?.id === shown.id ? null : s)), shown.for);
    return () => clearTimeout(t);
  }, [shown]);
  return shown;
}

const SNAP_KINDS = ['snap', 'snapGive'] as const;
const WRONG_KINDS = ['wrongSnap'] as const;
const RESHUFFLE_KINDS = ['reshuffle'] as const;
const CALL_KINDS = ['call'] as const;

/**
 * The snap: as the card slams onto the discard, a brass "Snap!" stamps over the pile with the
 * snapper's name. Chained snaps count up beside it.
 */
export function SnapCallout({
  layout,
  frame,
  name,
  reduced,
}: {
  layout: TvLayout;
  frame: MotionFrame;
  name: NameOf;
  reduced: boolean;
}) {
  const shown = useStepMoment(frame, SNAP_KINDS, 650);
  const e = shown?.step.event;
  const pile = layout.discard;
  const pileH = layout.spriteWidth * pile.scale * CARD_RATIO;
  const chain = shown?.step.after.discardChain ?? 0;
  return (
    <AnimatePresence>
      {shown && e?.type === 'snapped' && (
        <motion.div
          key={shown.id}
          role="status"
          data-testid="snap-callout"
          data-chain={chain}
          className="pointer-events-none absolute flex flex-col items-center font-card"
          style={{
            left: pile.x - 300,
            width: 600,
            bottom: layout.height - (pile.y - pileH / 2) + 4,
            zIndex: 95,
            transformOrigin: '50% 100%',
          }}
          initial={reduced ? false : { opacity: 0, scale: 1.5, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: -5 }}
          exit={{ opacity: 0, scale: 0.96, transition: { duration: reduced ? 0 : 0.16 } }}
          transition={{
            duration: 0.2,
            ease: ease.outQuint,
            delay: reduced ? 0 : (timing.snapFlight * shown.k) / 1000,
          }}
        >
          <span
            className="mb-1 max-w-full truncate rounded-full px-5 py-1 font-semibold [font-stretch:90%]"
            style={{ fontSize: 32, background: 'rgba(4,20,15,.85)', color: colors.chalk }}
          >
            {name(e.snapperId)}
          </span>
          <span className="flex items-baseline gap-4">
            <span
              className="font-black leading-[0.9] tracking-[-0.03em] [font-stretch:125%]"
              style={{
                fontSize: 104,
                color: colors.glow,
                textShadow: `0 3px 0 ${colors.rail}, 0 10px 30px rgba(0,0,0,.65)`,
              }}
            >
              {theme.tv.snap}
            </span>
            {chain >= 2 && (
              <span
                className="rounded-full px-4 py-1 font-extrabold leading-none tabular-nums [font-stretch:115%]"
                style={{ fontSize: 52, background: colors.glow, color: colors.ink }}
              >
                {theme.tv.chain(chain)}
              </span>
            )}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A wrong snap: who snapped, in red, under the pile while the card shows and shakes. */
export function WrongSnapCallout({
  layout,
  frame,
  name,
  reduced,
}: {
  layout: TvLayout;
  frame: MotionFrame;
  name: NameOf;
  reduced: boolean;
}) {
  const shown = useStepMoment(frame, WRONG_KINDS, 500);
  const e = shown?.step.event;
  const pile = layout.discard;
  const pileH = layout.spriteWidth * pile.scale * CARD_RATIO;
  return (
    <AnimatePresence>
      {shown && e?.type === 'snapFailed' && (
        <motion.div
          key={shown.id}
          role="status"
          data-testid="wrong-snap-callout"
          className="pointer-events-none absolute flex justify-center font-card"
          style={{
            left: layout.width / 2 - 400,
            width: 800,
            top: pile.y + pileH / 2 - 84,
            zIndex: 95,
          }}
          initial={reduced ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.15 } }}
          transition={{ duration: 0.2, ease: ease.outQuint }}
        >
          <span
            className="truncate rounded-full px-6 py-2 font-bold [font-stretch:95%]"
            style={{
              fontSize: 36,
              background: colors.danger,
              color: 'white',
              boxShadow: '0 10px 24px -10px rgba(0,0,0,.8)',
            }}
          >
            {theme.tv.wrongSnap}: {name(e.snapperId)}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Under the deck: how many cards are left, or "Reshuffling" while the discard sweeps back. */
export function DeckLabel({
  layout,
  frame,
  reduced,
}: {
  layout: TvLayout;
  frame: MotionFrame;
  reduced: boolean;
}) {
  const shown = useStepMoment(frame, RESHUFFLE_KINDS, 900);
  const deck = layout.deck;
  const h = layout.spriteWidth * deck.scale * CARD_RATIO;
  return (
    <div
      className="pointer-events-none absolute flex justify-center font-card"
      style={{ left: deck.x - 200, width: 400, top: deck.y + h / 2 - 22, zIndex: 66 }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {shown ? (
          <motion.span
            key="reshuffle"
            data-testid="reshuffle-label"
            className="rounded-full px-4 py-1 font-semibold"
            style={{ fontSize: 28, background: colors.glow, color: colors.ink }}
            initial={reduced ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.2, ease: ease.outCubic }}
          >
            {theme.tv.reshuffling}
          </motion.span>
        ) : (
          <motion.span
            key="count"
            className="rounded-full px-4 py-1 tabular-nums"
            style={{ fontSize: 22, color: colors.chalk, background: 'rgba(4,20,15,.85)' }}
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            {theme.tv.deck(frame.scene.deckCount)}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Cambio! A big banner over the table as the call lands, then it docks in the top bar with the
 * final turns left until the reveal.
 */
export function CambioCall({
  layout,
  frame,
  view,
  name,
  reduced,
}: {
  layout: TvLayout;
  frame: MotionFrame;
  view: CambioHostView;
  name: NameOf;
  reduced: boolean;
}) {
  const shown = useStepMoment(frame, CALL_KINDS, 1200);
  const callerId = frame.scene.callerId;
  const docked = !shown && !!callerId && view.phase === 'play';
  const locked = !!view.lockedPlayerId;
  const left = turnsLeft(view);
  return (
    <>
      <AnimatePresence>
        {shown && callerId && (
          <motion.div
            key={shown.id}
            role="status"
            data-testid="cambio-banner"
            data-docked="false"
            className="pointer-events-none absolute inset-x-0 flex justify-center font-card"
            style={{ top: layout.felt.cy - 90, zIndex: 120 }}
            initial={reduced ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              y: -layout.felt.cy + 60,
              scale: 0.6,
              transition: { duration: reduced ? 0 : 0.32, ease: ease.inOutCubic },
            }}
            transition={{ duration: 0.28, ease: ease.outQuint }}
          >
            <span
              className="flex items-center gap-6 rounded-[28px] px-14 py-6 font-black leading-none tracking-[-0.02em] [font-stretch:120%]"
              style={{
                fontSize: 96,
                background: colors.danger,
                color: 'white',
                boxShadow: `0 0 0 6px ${colors.rail}, 0 30px 80px -20px rgba(0,0,0,.9)`,
              }}
            >
              {locked && <LockIcon size={72} />}
              {theme.tv.called(name(callerId))}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {docked && callerId && (
          <motion.div
            key="docked"
            role="status"
            data-testid="cambio-banner"
            data-docked="true"
            className="pointer-events-none absolute inset-x-0 flex justify-center font-card"
            style={{ top: layout.bands.top / 2 - 30, zIndex: 120 }}
            initial={reduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.24, ease: ease.outQuint }}
          >
            <span
              className="flex h-[60px] items-center gap-4 rounded-full px-7 font-bold [font-stretch:95%]"
              style={{ fontSize: 32, background: colors.danger, color: 'white' }}
            >
              {locked && <LockIcon size={28} />}
              <span className="truncate">{theme.tv.calledShort(name(callerId))}</span>
              <span
                className="rounded-full px-4 py-1 tabular-nums"
                style={{ background: 'rgba(0,0,0,.25)' }}
              >
                {theme.tv.finalTurns(left)}
              </span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
