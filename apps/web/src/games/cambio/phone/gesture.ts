import { useRef, type PointerEvent } from 'react';

/** A swipe must travel at least this far up to snap. */
export const SWIPE_MIN = 40;
/** A press that moves less than this is a tap. */
export const TAP_SLOP = 10;

export type Gesture = 'tap' | 'swipe' | 'none';

/**
 * A finished drag, by how far it moved: up is negative `dy`, as on screen. A swipe goes at least
 * 40 px up and is mostly vertical (twice as far up as across). A press that barely moves is a
 * tap. Anything in between, short or sideways, does nothing.
 */
export function classifyGesture(dx: number, dy: number): Gesture {
  const up = -dy;
  if (up >= SWIPE_MIN && up >= 2 * Math.abs(dx)) return 'swipe';
  if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) return 'tap';
  return 'none';
}

export interface TapSwipeBindings {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
}

/** Pointer handlers that call `onTap` or `onSwipe` once a press ends, per `classifyGesture`. */
export function useTapSwipe(handlers: {
  onTap?: () => void;
  onSwipe?: () => void;
}): TapSwipeBindings {
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  const latest = useRef(handlers);
  latest.current = handlers;
  return {
    onPointerDown: (e) => {
      if (e.button > 0) return;
      start.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      // Keep receiving the move even if the finger leaves the card on its way up.
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Synthetic events in tests have no active pointer to capture.
      }
    },
    onPointerUp: (e) => {
      const s = start.current;
      start.current = null;
      if (!s || s.id !== e.pointerId) return;
      const g = classifyGesture(e.clientX - s.x, e.clientY - s.y);
      if (g === 'tap') latest.current.onTap?.();
      if (g === 'swipe') latest.current.onSwipe?.();
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
