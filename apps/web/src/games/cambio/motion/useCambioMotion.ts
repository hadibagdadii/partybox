import type { CambioHostView } from '@partybox/cambio';
import { useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { MotionQueue, eventsSince, type Highlight, type LogCursor, type Playing } from './queue';
import { sceneFromView, type Scene } from './scene';
import { stepsFor } from './steps';

export interface MotionFrame {
  /** What to draw: the playing step's end state, or the real state when idle. */
  scene: Scene;
  playing: Playing | null;
  highlight: Highlight | null;
  reduced: boolean;
  timeScale: number;
  /** Ms of motion queued behind the current step. */
  backlog: number;
  collapsed: number;
  /** Events received but not yet started on screen, newest last in the view's log. */
  pending: number;
}

export interface MotionOptions {
  /** Overrides the viewer's prefers-reduced-motion setting (the gallery's toggle). */
  reduced?: boolean;
  timeScale?: number;
  now?: () => number;
  /** Time between hands turning over at the round's end. */
  revealStagger?: number;
}

const clock = () => performance.now();

/**
 * Drives card motion from a view's public event log. The first view only sets a baseline, so a
 * refresh or remount shows the current state without replaying history. Re-renders only when a
 * step starts or ends; the frames in between belong to Motion.
 */
export function useCambioMotion(view: CambioHostView, opts: MotionOptions = {}): MotionFrame {
  const prefersReduced = useReducedMotion() ?? false;
  const reduced = opts.reduced ?? prefersReduced;
  const timeScale = opts.timeScale ?? 1;
  const now = opts.now ?? clock;
  const revealStagger = opts.revealStagger;

  const queue = useRef<MotionQueue | null>(null);
  const cursor = useRef<LogCursor | null>(null);
  const tail = useRef<Scene | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  if (!queue.current) {
    const scene = sceneFromView(view);
    queue.current = new MotionQueue(scene, { now, reduced, timeScale });
    cursor.current = { round: view.round, length: view.log.length };
    tail.current = scene;
  }
  const q = queue.current;
  q.reduced = reduced;
  q.timeScale = timeScale;

  useLayoutEffect(() => {
    const truth = sceneFromView(view);
    const { events, cursor: next } = eventsSince(cursor.current!, view);
    cursor.current = next;
    if (!events.length) {
      if (q.idle) q.reset(truth);
      tail.current = truth;
      return;
    }
    const { steps } = stepsFor(tail.current!, events, { revealStagger });
    // The real state is authoritative: the next events build on it, not on our model of it.
    tail.current = truth;
    q.push(steps, truth);
    rerender();
  }, [view, q, revealStagger]);

  useEffect(() => {
    const wait = q.nextWakeIn();
    if (wait === null) return;
    const t = setTimeout(() => {
      q.tick();
      rerender();
    }, wait);
    return () => clearTimeout(t);
  });

  return {
    scene: q.scene,
    playing: q.current,
    highlight: q.highlight,
    reduced,
    timeScale,
    backlog: q.backlog(),
    collapsed: q.collapsed,
    pending: q.pending.length,
  };
}
