import { theme } from '@partybox/diwan';
import type { LobbyView } from '@partybox/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureRoom, hostView } from '../tv/fixtures';
import { herald, type Speaker } from '../tv/herald';
import { TutorialPhone } from './TutorialPhone';
import { TutorialTv } from './TutorialTv';

const { slides } = theme.tutorial;

function lobby(slide: number): LobbyView {
  return { ...fixtureRoom(hostView()), phase: 'lobby', tutorial: { slide, total: slides.length } };
}

function fakeSpeaker() {
  const spoken: string[] = [];
  const speaker: Speaker = {
    speak: (text, _voice, onEnd) => {
      spoken.push(text);
      onEnd();
    },
    cancel: vi.fn(),
    voices: () => [],
    onVoicesChanged: () => () => undefined,
  };
  return { speaker, spoken };
}

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

let fake: ReturnType<typeof fakeSpeaker>;
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  fake = fakeSpeaker();
  herald.reset(fake.speaker);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  herald.reset(null);
});

function renderTv(slide: number) {
  const ui = (n: number) => <TutorialTv room={lobby(n)} game={null} />;
  const result = render(ui(slide), { wrapper: MemoryRouter });
  return { rerender: (n: number) => result.rerender(ui(n)) };
}

describe('TutorialTv', () => {
  it('draws the slide the room is on, from the real game pieces', () => {
    const { rerender } = renderTv(3);
    expect(screen.getByRole('heading', { name: slides[3]!.title })).toBeTruthy();
    expect(screen.getByTestId('progress').textContent).toContain(theme.tutorial.progress(4, 7));
    expect(screen.getAllByText(theme.decrees.rebel).length).toBeGreaterThan(0);

    rerender(4);
    expect(screen.getAllByTestId('unrest').map((n) => n.textContent)).toEqual([
      '1/3',
      '2/3',
      '3/3',
    ]);
    rerender(6);
    expect(screen.getByTestId('track-loyal')).toBeTruthy();
    expect(screen.getByTestId('track-rebel')).toBeTruthy();
  });

  it('shows every slide without crashing', () => {
    const { rerender } = renderTv(0);
    for (let i = 0; i < slides.length; i++) {
      rerender(i);
      expect(screen.getByRole('heading', { name: slides[i]!.title })).toBeTruthy();
      expect(screen.getByText(slides[i]!.body)).toBeTruthy();
    }
  });

  it('always captions the slide, and the herald reads one line per slide once enabled', () => {
    const { rerender } = renderTv(0);
    expect(screen.getByTestId('caption').textContent).toBe(slides[0]!.herald);
    expect(fake.spoken).toEqual([]);

    act(() => herald.enable());
    rerender(1);
    rerender(1);
    rerender(2);
    expect(fake.spoken).toEqual([theme.tv.heraldReady, slides[1]!.herald, slides[2]!.herald]);
    expect(screen.getByTestId('caption').textContent).toBe(slides[2]!.herald);

    act(() => herald.setMuted(true));
    rerender(3);
    expect(fake.spoken).toHaveLength(3);
    expect(screen.getByTestId('caption').textContent).toBe(slides[3]!.herald);
  });
});

describe('TutorialPhone', () => {
  function renderPhone(isVip: boolean, slide = 2) {
    const step = vi.fn();
    const skip = vi.fn();
    render(
      <TutorialPhone
        room={lobby(slide)}
        you={{ id: 'p1', name: 'Amina', isVip }}
        step={step}
        skip={skip}
      />,
    );
    return { step, skip };
  }

  it('gives the VIP Next, Back, and Skip', () => {
    const { step, skip } = renderPhone(true);
    fireEvent.click(screen.getByRole('button', { name: theme.tutorial.next }));
    fireEvent.click(screen.getByRole('button', { name: theme.tutorial.back }));
    fireEvent.click(screen.getByRole('button', { name: theme.tutorial.skip }));
    expect(step.mock.calls).toEqual([['next'], ['back']]);
    expect(skip).toHaveBeenCalledOnce();
    expect(screen.queryByText(theme.tutorial.watchTv)).toBeNull();
  });

  it('turns Next into Start the game on the last slide, and disables Back on the first', () => {
    renderPhone(true, 6);
    expect(screen.getByRole('button', { name: theme.tutorial.begin })).toBeTruthy();
    cleanup();
    renderPhone(true, 0);
    expect(screen.getByRole('button', { name: theme.tutorial.back }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('tells everyone else to watch the TV, with no controls', () => {
    renderPhone(false);
    expect(screen.getByRole('heading', { name: theme.tutorial.watchTv })).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
