import { buildFixture } from '@partybox/cambio/fixtures';
import type { CambioHostView } from '@partybox/cambio';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardLayer } from './CardLayer';
import { tableLayout } from './layout';
import { privateFaces, sceneFromView, sceneKey } from './scene';
import { useCambioMotion } from './useCambioMotion';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const clock = () => Date.now();

describe('useCambioMotion', () => {
  it('shows the current state on first render without replaying the log', () => {
    const f = buildFixture('burst', 6);
    const late = f.steps.at(-1)!.host;
    expect(late.log.length).toBeGreaterThan(20);
    const { result } = renderHook(() => useCambioMotion(late, { now: clock, reduced: false }));
    expect(result.current.playing).toBeNull();
    expect(sceneKey(result.current.scene)).toEqual(sceneKey(sceneFromView(late)));
  });

  it('settles on the true state after a burst of broadcasts', () => {
    const f = buildFixture('burst', 12);
    const { result, rerender } = renderHook(
      ({ view }: { view: CambioHostView }) => useCambioMotion(view, { now: clock, reduced: false }),
      { initialProps: { view: f.before.host } },
    );
    for (const step of f.steps) {
      rerender({ view: step.host });
      act(() => void vi.advanceTimersByTime(15));
      expect(result.current.backlog).toBeLessThanOrEqual(1000);
    }
    expect(result.current.collapsed).toBeGreaterThan(0);
    // Each step schedules the next tick from an effect, so let React commit between them.
    for (let i = 0; i < 100 && result.current.playing; i++)
      act(() => void vi.advanceTimersByTime(100));
    expect(result.current.playing).toBeNull();
    expect(sceneKey(result.current.scene)).toEqual(sceneKey(sceneFromView(f.steps.at(-1)!.host)));
  });

  it('with reduced motion moves instantly and highlights the moved cards', () => {
    const f = buildFixture('swap', 6);
    const { result, rerender } = renderHook(
      ({ view }: { view: CambioHostView }) => useCambioMotion(view, { now: clock, reduced: true }),
      { initialProps: { view: f.before.host } },
    );
    rerender({ view: f.steps[0]!.host });
    expect(result.current.playing).toBeNull();
    expect(result.current.backlog).toBe(0);
    expect(sceneKey(result.current.scene)).toEqual(sceneKey(sceneFromView(f.steps[0]!.host)));
    const e = f.steps[0]!.events[0]!;
    if (e.type !== 'swapped') throw new Error('expected swapped');
    expect(result.current.highlight?.cardIds).toEqual(
      expect.arrayContaining([e.cardId, e.discarded.cardId]),
    );
  });
});

describe('CardLayer', () => {
  const layout = tableLayout(
    1600,
    900,
    buildFixture('draw', 6).before.host.players.map((p) => p.id),
  );

  it('renders one element per card id and only public faces on the TV', () => {
    const f = buildFixture('peekOwn', 6);
    const view = f.steps[0]!.host; // mid-peek: the TV must not see the peeked face
    const scene = sceneFromView(view);
    const { container } = render(
      <CardLayer scene={scene} playing={null} highlight={null} layout={layout} />,
    );
    const ids = [...container.querySelectorAll('[data-card-id]')].map((e) =>
      e.getAttribute('data-card-id'),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(
      scene.seats.reduce((n, s) => n + s.slots.length, 0) + scene.discard.length,
    );
    expect(container.querySelectorAll('[data-face]')).toHaveLength(scene.discard.length);
  });

  it("shows the peeked face on the peeker's phone only", () => {
    const f = buildFixture('peekOwn', 6);
    const step = f.steps[0]!;
    const scene = sceneFromView(step.peeker);
    const perspective = { youId: f.peekerId, privateFaces: privateFaces(step.peeker) };
    const { container } = render(
      <CardLayer
        scene={scene}
        playing={null}
        highlight={null}
        layout={layout}
        perspective={perspective}
      />,
    );
    expect(container.querySelectorAll('[data-face]')).toHaveLength(scene.discard.length + 1);
  });
});
