import { theme } from '@partybox/cambio';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Box } from '../motion/layout';
import { colors, ease } from '../tokens';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The Rules chip in the strip's top-right corner, and the sheet it opens: the six tutorial
 * topics as a short read. The sheet traps focus, closes on Escape or a tap outside, and gives
 * focus back to the chip.
 */
export function RulesSheet({ chip }: { chip: Box }) {
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={chipRef}
        type="button"
        data-testid="rules-chip"
        aria-label={theme.rules.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="no-callout absolute z-[95] grid place-items-center rounded-full outline-none transition-transform duration-150 ease-out focus-visible:shadow-[0_0_0_3px_#f2d27a] active:scale-[0.97] motion-reduce:transition-none"
        style={{ left: chip.x, top: chip.y, width: chip.w, height: chip.h }}
      >
        {/* The visible chip is smaller than its 44 px hit area. */}
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-full text-[17px] font-bold leading-none"
          style={{
            background: 'rgba(5,24,18,.6)',
            color: colors.chalk,
            boxShadow: 'inset 0 0 0 1px rgba(233,239,233,.22)',
          }}
        >
          ?
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <Sheet
            onClose={() => {
              setOpen(false);
              chipRef.current?.focus();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function Sheet({ onClose }: { onClose: () => void }) {
  const reduced = useReducedMotion() ?? false;
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const fade = reduced
    ? {}
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
  const rise = reduced ? {} : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };
  const transition = { duration: 0.24, ease: ease.outQuint };
  return (
    <div className="fixed inset-0 z-[300]" onKeyDown={onKeyDown}>
      <motion.div
        aria-hidden="true"
        data-testid="rules-backdrop"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
        transition={transition}
        {...fade}
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="pb-safe absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-[24px] font-card"
        style={{
          background: '#06201a',
          color: colors.chalk,
          boxShadow: '0 0 0 1px rgba(233,239,233,.1), 0 -20px 50px -20px rgba(0,0,0,.8)',
        }}
        transition={transition}
        {...rise}
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 id={titleId} className="text-2xl font-extrabold [font-stretch:110%]">
            {theme.rules.title}
          </h2>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full px-4 text-base font-semibold outline-none transition-transform duration-150 ease-out focus-visible:shadow-[0_0_0_3px_#f2d27a] active:scale-[0.97] motion-reduce:transition-none"
            style={{ background: 'rgba(233,239,233,.1)' }}
          >
            {theme.rules.close}
          </button>
        </div>
        <ol className="m-0 flex list-none flex-col gap-3 overflow-y-auto overscroll-contain px-5 pb-5 pt-1">
          {theme.tutorial.slides.map((slide, i) => (
            <li
              key={slide.title}
              className="rounded-[16px] px-4 py-3"
              style={{ background: 'rgba(233,239,233,.06)' }}
            >
              <h3 className="text-lg font-bold">
                <span className="mr-2 tabular-nums" style={{ color: colors.brassLight }}>
                  {i + 1}.
                </span>
                {slide.title}
              </h3>
              <p
                className="mt-1 text-base leading-snug [text-wrap:pretty]"
                style={{ color: colors.chalk }}
              >
                {slide.body}
              </p>
            </li>
          ))}
        </ol>
      </motion.div>
    </div>
  );
}
