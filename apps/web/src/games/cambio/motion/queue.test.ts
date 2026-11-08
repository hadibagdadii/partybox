import { buildFixture, type FixtureId } from '@partybox/cambio/fixtures';
import { describe, expect, it } from 'vitest';
import { timing } from '../tokens';
import { MotionQueue, eventsSince } from './queue';
import { sceneFromView, sceneKey, type Scene } from './scene';
import { stepsFor, type Step } from './steps';

/** A queue on a fake clock. */
function harness(scene: Scene, opts: { reduced?: boolean } = {}) {
  let t = 0;
  const q = new MotionQueue(scene, { now: () => t, ...opts });
  return {
    q,
    advance(ms: number) {
      t += ms;
      q.tick();
    },
    /** Runs the clock until the queue is idle; returns the kinds that played, in order. */
    drain() {
      const played: string[] = [];
      for (let guard = 0; guard < 1000 && !q.idle; guard++) {
        if (q.current && played.at(-1) !== `${q.current.id}`) played.push(`${q.current.id}`);
        const wait = q.nextWakeIn() ?? 0;
        t += wait;
        q.tick();
      }
      return played;
    },
    get t() {
      return t;
    },
  };
}

function fixtureSteps(id: FixtureId, count = 6) {
  const f = buildFixture(id, count);
  const start = sceneFromView(f.before.host);
  let scene = start;
  const batches = f.steps.map((s) => {
    const r = stepsFor(scene, s.events);
    scene = r.scene;
    return { steps: r.steps, truth: sceneFromView(s.host) };
  });
  return { start, batches, f };
}

const motion = (steps: Step[]) => steps.filter((s) => s.duration > 0);

describe('event queue', () => {
  it('plays steps in event order, one at a time', () => {
    const { start, batches } = fixtureSteps('burst');
    const h = harness(start);
    const order: Step[] = [];
    // Slow arrivals: everything plays in full and in order.
    for (const b of batches) {
      h.q.push(b.steps, b.truth);
      while (!h.q.idle) {
        const cur = h.q.current;
        if (cur && order.at(-1) !== cur.step) order.push(cur.step);
        h.advance(h.q.nextWakeIn() ?? 0);
      }
    }
    const expected = batches.flatMap((b) => motion(b.steps));
    expect(order).toEqual(expected);
    expect(h.q.collapsed).toBe(0);
  });

  it('keeps the backlog behind the current step within a second during a burst', () => {
    const { start, batches } = fixtureSteps('burst');
    const h = harness(start);
    for (const b of batches) {
      h.q.push(b.steps, b.truth);
      expect(h.q.backlog()).toBeLessThanOrEqual(timing.lagBudget);
      h.advance(20); // bots firing every 20 ms
    }
    expect(h.q.collapsed).toBeGreaterThan(0);
    // The newest motion still plays.
    const last = motion(batches.at(-1)!.steps).at(-1)!;
    h.drain();
    expect(h.q.idle).toBe(true);
    expect(last.duration).toBeGreaterThan(0);
  });

  it('skips the oldest steps first and keeps the newest moving', () => {
    const { start, batches } = fixtureSteps('burst');
    const h = harness(start);
    const all = batches.flatMap((b) => b.steps);
    h.q.push(all, batches.at(-1)!.truth);
    const rates = h.q.pending.filter((p) => p.step.duration > 0).map((p) => p.rate);
    const firstKept = rates.findIndex((r) => r > 0);
    expect(rates.slice(0, firstKept).every((r) => r === 0)).toBe(true);
    expect(rates.slice(firstKept).every((r) => r > 0)).toBe(true);
    expect(rates.at(-1)).toBeGreaterThan(0);
  });

  it('settles on the true state after a burst', () => {
    const { start, batches } = fixtureSteps('burst', 12);
    const h = harness(start);
    for (const b of batches) {
      h.q.push(b.steps, b.truth);
      h.advance(5);
    }
    h.drain();
    expect(sceneKey(h.q.scene)).toEqual(sceneKey(batches.at(-1)!.truth));
  });

  it.each(['draw', 'swap', 'discard', 'blindSwap', 'snapGive', 'wrongSnap', 'reshuffle'] as const)(
    'plays a lone %s at full speed, in real time and in slow motion',
    (id) => {
      for (const timeScale of [1, 4]) {
        const { start, batches } = fixtureSteps(id);
        let t = 0;
        const q = new MotionQueue(start, { now: () => t, timeScale });
        const b = batches.at(-1)!;
        q.push(b.steps, b.truth);
        expect(q.current?.rate).toBe(1);
        expect(q.current!.end - q.current!.start).toBe(q.current!.step.duration * timeScale);
        t += 1;
      }
    },
  );

  it.each(['deal', 'reveal'] as const)('plays a lone 12-player %s at full length', (id) => {
    const { start, batches } = fixtureSteps(id, 12);
    const h = harness(start);
    const b = batches.at(-1)!;
    h.q.push(b.steps, b.truth);
    const long = b.steps.find((s) => s.long)!;
    expect(long.duration).toBeGreaterThan(timing.lagBudget);
    // The reveal's last turn (a discard) plays first; nothing queues behind the reveal.
    while (h.q.current && h.q.current.step !== long) h.advance(h.q.nextWakeIn() ?? 0);
    const started = h.t;
    expect(h.q.current?.step).toBe(long);
    expect(h.q.current!.end - h.q.current!.start).toBe(long.duration);
    expect(h.q.current!.rate).toBe(1);
    expect(h.q.current!.rushed).toBeNull();
    h.drain();
    expect(h.t - started).toBe(long.duration);
    expect(h.q.collapsed).toBe(0);
  });

  it('hurries a deal once newer motion queues behind it', () => {
    const deal = fixtureSteps('deal', 12);
    const h = harness(deal.start);
    const b = deal.batches[0]!;
    h.q.push(b.steps, b.truth);
    h.advance(200);
    // A snap arrives while the deal is still flying.
    const snap = fixtureSteps('snap', 12).batches[0]!;
    h.q.push(snap.steps, b.truth);
    const cur = h.q.current!;
    expect(cur.step.kind).toBe('deal');
    expect(cur.rushed).not.toBeNull();
    expect(cur.end - h.t).toBeLessThanOrEqual(timing.rushWithin);
  });

  it('a new round plays its whole log from the deal', () => {
    const { f } = fixtureSteps('deal');
    const before = f.before.host;
    const after = f.steps[0]!.host;
    const { events } = eventsSince({ round: before.round, length: before.log.length }, after);
    expect(events[0]?.type).toBe('dealt');
    expect(events).toEqual(after.log);
  });

  it('only reads events after the cursor within a round', () => {
    const { f } = fixtureSteps('burst');
    const a = f.steps[3]!.host;
    const b = f.steps[6]!.host;
    const r = eventsSince({ round: a.round, length: a.log.length }, b);
    expect(r.events).toEqual(b.log.slice(a.log.length));
    expect(r.cursor).toEqual({ round: b.round, length: b.log.length });
  });

  it('reduced motion moves instantly and highlights what changed', () => {
    const { start, batches } = fixtureSteps('snapGive');
    const h = harness(start, { reduced: true });
    const b = batches[0]!;
    h.q.push(b.steps, b.truth);
    expect(h.q.current).toBeNull();
    expect(h.q.idle).toBe(true);
    expect(h.q.backlog()).toBe(0);
    expect(sceneKey(h.q.scene)).toEqual(sceneKey(b.truth));
    const touched = b.steps.flatMap((s) => s.touched);
    expect(h.q.highlight?.cardIds.sort()).toEqual([...new Set(touched)].sort());
  });

  it('reset shows the given scene with nothing queued', () => {
    const { start, batches } = fixtureSteps('burst');
    const h = harness(start);
    h.q.push(batches[0]!.steps, batches[0]!.truth);
    h.q.reset(batches[5]!.truth);
    expect(h.q.idle).toBe(true);
    expect(h.q.scene).toBe(batches[5]!.truth);
  });
});
