import { cambioModule, theme } from '@partybox/cambio';
import type { LobbyView } from '@partybox/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { herald, type Speaker } from '../../../lib/herald';
import { TutorialPhone } from './TutorialPhone';
import { TutorialTv } from './TutorialTv';

const { slides } = theme.tutorial;

function lobby(slide: number): LobbyView {
  return {
    code: 'BCDF',
    gameId: 'cambio',
    gameName: theme.title,
    minPlayers: 2,
    maxPlayers: 12,
    phase: 'lobby',
    players: [
      {
        id: 'p1',
        name: 'Real Player',
        connected: true,
        isVip: true,
        isBot: false,
        awayLong: false,
      },
    ],
    tutorial: { slide, total: slides.length },
    options: null,
  } as LobbyView;
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
  return { ...result, rerender: (n: number) => result.rerender(ui(n)) };
}

describe('Cambio TutorialTv', () => {
  it('has as many slides as the module tells the room', () => {
    expect(cambioModule.tutorialSlides).toBe(slides.length);
    expect(slides).toHaveLength(6);
  });

  it('shows every slide, from the real cards and table', () => {
    const { rerender, container } = renderTv(0);
    expect(screen.getByTestId('value-cards').querySelectorAll('[data-card]')).toHaveLength(7);
    for (let i = 0; i < slides.length; i++) {
      rerender(i);
      expect(screen.getByRole('heading', { name: slides[i]!.title })).toBeTruthy();
      expect(screen.getByText(slides[i]!.body)).toBeTruthy();
      expect(screen.getByTestId('progress').textContent).toContain(
        theme.tutorial.progress(i + 1, slides.length),
      );
      if (i > 0) expect(container.querySelector('[data-clip]')).not.toBeNull();
    }
  });

  it('names each power as its clip plays', () => {
    renderTv(3);
    for (const name of [
      theme.powers.peekOwn.name,
      theme.powers.peekOther.name,
      theme.powers.swapOthers.name,
      theme.powers.peekSwap.name,
    ]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(document.querySelector('[aria-current="step"]')?.textContent).toBe(
      theme.powers.peekOwn.name,
    );
  });

  it('moves to the next clip once one finishes', async () => {
    const { container } = renderTv(2);
    expect(container.querySelector('[data-clip]')?.getAttribute('data-clip')).toBe('draw');
    // Short acts, so effects (which schedule the motion's timers) flush between them.
    for (let i = 0; i < 15; i++) await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(container.querySelector('[data-clip]')?.getAttribute('data-clip')).toBe('swap');
  }, 10_000);

  it('never draws the room: no real player appears on any slide', () => {
    const { rerender, container } = renderTv(0);
    for (let i = 0; i < slides.length; i++) {
      rerender(i);
      expect(container.textContent).not.toContain('Real Player');
    }
  });

  it('always captions the slide, and narrates one line per slide once enabled', () => {
    const { rerender } = renderTv(0);
    expect(screen.getByTestId('caption').textContent).toBe(slides[0]!.herald);
    expect(fake.spoken).toEqual([]);
    act(() => herald.enable());
    rerender(1);
    rerender(1);
    rerender(2);
    expect(fake.spoken).toEqual([slides[1]!.herald, slides[2]!.herald]);
  });
});

describe('Cambio TutorialPhone', () => {
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
    expect(screen.getByRole('heading', { name: slides[2]!.title })).toBeTruthy();
  });

  it('turns Next into Start game on the last slide, and disables Back on the first', () => {
    renderPhone(true, slides.length - 1);
    expect(screen.getByRole('button', { name: theme.tutorial.begin })).toBeTruthy();
    expect(screen.queryByRole('button', { name: theme.tutorial.skip })).toBeNull();
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
