import type { CambioEvent, CambioHostView } from '@partybox/cambio';
import { timing } from '../tokens';
import type { Scene } from './scene';
import type { Step } from './steps';

/** Where the motion system has read the round's log up to. */
export interface LogCursor {
  round: number;
  length: number;
}

/**
 * New events since `cursor`. A new round (or a new game: the log got shorter) starts its log
 * over, so everything in it is new; that log begins with `dealt`.
 */
export function eventsSince(
  cursor: LogCursor,
  view: Pick<CambioHostView, 'round' | 'log'>,
): { events: CambioEvent[]; cursor: LogCursor } {
  const next = { round: view.round, length: view.log.length };
  const restarted = view.round !== cursor.round || view.log.length < cursor.length;
  return { events: restarted ? [...view.log] : view.log.slice(cursor.length), cursor: next };
}

export interface Playing {
  /** Increments for every step that starts, so views can key per-step effects. */
  id: number;
  step: Step;
  start: number;
  end: number;
  /** Multiplies every time in the step: below 1 is faster. */
  rate: number;
  /** Set when a long step was told to hurry: from `at`, the rest plays `speedup` times faster. */
  rushed: { at: number; speedup: number } | null;
}

interface Pending {
  step: Step;
  /** Below 1 when the queue sped this step up. */
  rate: number;
}

export interface Highlight {
  key: number;
  cardIds: string[];
}

export interface QueueOptions {
  now: () => number;
  reduced?: boolean;
  /** Slows or speeds everything (the gallery's slow motion). 1 is real time. */
  timeScale?: number;
  budget?: number;
}

const isMotion = (s: Step) => s.duration > 0;

/**
 * Plays steps one at a time in event order. The backlog behind the current step is kept within
 * the lag budget by speeding up, then skipping, the oldest pending steps; the newest always keeps
 * some motion. Deals and reveals play in full unless newer motion queues behind them. When the
 * queue is empty the scene is the real state, so the screen always settles on the truth.
 */
export class MotionQueue {
  private queue: Pending[] = [];
  private playing: Playing | null = null;
  private truth: Scene;
  private serial = 0;
  private flash: Highlight | null = null;
  /** Steps skipped to keep up; for tests and the gallery's readout. */
  collapsed = 0;
  reduced: boolean;
  timeScale: number;
  private readonly now: () => number;
  private readonly budget: number;

  constructor(initial: Scene, opts: QueueOptions) {
    this.truth = initial;
    this.now = opts.now;
    this.reduced = opts.reduced ?? false;
    this.timeScale = opts.timeScale ?? 1;
    this.budget = opts.budget ?? timing.lagBudget;
  }

  /** Drops everything and shows `scene` as is: a refresh or a remount never replays. */
  reset(scene: Scene): void {
    this.queue = [];
    this.playing = null;
    this.truth = scene;
    this.flash = null;
  }

  get current(): Playing | null {
    return this.playing;
  }

  get pending(): readonly Pending[] {
    return this.queue;
  }

  get highlight(): Highlight | null {
    return this.flash;
  }

  /** What to draw now: the playing step's end state, or the real state when idle. */
  get scene(): Scene {
    return this.playing?.step.after ?? this.queue[0]?.step.before ?? this.truth;
  }

  get idle(): boolean {
    return !this.playing && this.queue.length === 0;
  }

  /** Pending time behind the current step, in ms. A trailing deal or reveal does not count. */
  backlog(): number {
    const last = this.lastMotionIndex();
    return this.queue.reduce((sum, p, i) => {
      if (i === last && p.step.long) return sum;
      return sum + p.step.duration * p.rate * this.timeScale;
    }, 0);
  }

  /** Adds the steps for newly seen events; `truth` is the real state after all of them. */
  push(steps: readonly Step[], truth: Scene): void {
    this.truth = truth;
    if (this.reduced) {
      // Instant moves plus a short highlight on what changed.
      this.queue = [];
      this.playing = null;
      const touched = steps.flatMap((s) => s.touched);
      if (touched.length) this.flash = { key: ++this.serial, cardIds: [...new Set(touched)] };
      return;
    }
    for (const step of steps) this.queue.push({ step, rate: 1 });
    // Start the next step first: only what waits behind the current step counts as backlog.
    this.tick();
    this.compress();
    this.tick();
  }

  /** Starts whatever is due. Returns true if what to draw changed. */
  tick(): boolean {
    const t = this.now();
    let changed = false;
    if (this.playing && t >= this.playing.end) {
      this.playing = null;
      changed = true;
    }
    while (!this.playing && this.queue.length) {
      const next = this.queue.shift()!;
      changed = true;
      const length = next.step.duration * next.rate * this.timeScale;
      if (length <= 0) continue;
      this.playing = {
        id: ++this.serial,
        step: next.step,
        start: t,
        end: t + length,
        rate: next.rate,
        rushed: null,
      };
    }
    return changed;
  }

  /** Ms until the next tick has work, or null when idle. */
  nextWakeIn(): number | null {
    if (this.playing) return Math.max(0, this.playing.end - this.now());
    return this.queue.length ? 0 : null;
  }

  private lastMotionIndex(): number {
    for (let i = this.queue.length - 1; i >= 0; i--) if (isMotion(this.queue[i]!.step)) return i;
    return -1;
  }

  private compress(): void {
    const t = this.now();
    const behind = this.queue.some((p) => isMotion(p.step));
    // A long step that is playing hurries once newer motion queues behind it.
    const p = this.playing;
    if (p && p.step.long && behind && !p.rushed) {
      const left = p.end - t;
      const within = timing.rushWithin * this.timeScale;
      if (left > within) {
        p.rushed = { at: t, speedup: left / within };
        p.end = t + within;
      }
    }
    const budget = this.budget * this.timeScale;
    if (this.backlog() <= budget) return;

    // 1. Speed up pending steps, oldest first, to half length with a floor.
    const lastMotion = this.lastMotionIndex();
    for (const [i, q] of this.queue.entries()) {
      if (!isMotion(q.step) || (i === lastMotion && q.step.long)) continue;
      const base = q.step.duration;
      const fast = Math.max(base * 0.5, Math.min(base, timing.minStep));
      q.rate = Math.min(q.rate, fast / base);
      if (this.backlog() <= budget) return;
    }

    // 2. Skip the oldest pending motion steps; the newest keeps its motion.
    const last = this.lastMotionIndex();
    for (let i = 0; i < last && this.backlog() > budget; i++) {
      const q = this.queue[i]!;
      if (!isMotion(q.step) || q.rate === 0) continue;
      q.rate = 0;
      this.collapsed += 1;
    }

    // 3. If the newest alone is still over, it plays within the budget.
    const newest = this.queue[last];
    if (newest && this.backlog() > budget) {
      newest.rate = Math.min(newest.rate, budget / (newest.step.duration * this.timeScale));
    }
  }
}
