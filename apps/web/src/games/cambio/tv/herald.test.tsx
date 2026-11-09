import { theme, type CambioEvent, type CambioHostView } from '@partybox/cambio';
import { buildFixture } from '@partybox/cambio/fixtures';
import type { LobbyView } from '@partybox/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { herald, type Speaker } from '../../../lib/herald';
import { applyEvent } from '../motion/steps';
import { sceneFromView } from '../motion/scene';
import { timing } from '../tokens';
import { CambioLobbyExtras } from './CambioSettings';
import { CambioTv } from './CambioTv';
import { cambioHeraldLine } from './herald';
import { cardSounds, cuesFor, type CardSound, type Synth } from './sound';

/** Node's own localStorage shadows jsdom's in this setup; use a plain in-memory one. */
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

let spoken: string[];
let played: CardSound[];
let resumed: number;

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  spoken = [];
  played = [];
  resumed = 0;
  const speaker: Speaker = {
    speak: (text, _voice, onEnd) => {
      spoken.push(text);
      onEnd();
    },
    cancel: vi.fn(),
    voices: () => [],
    onVoicesChanged: () => () => undefined,
  };
  const synth: Synth = {
    play: (sound) => void played.push(sound),
    resume: () => void (resumed += 1),
  };
  herald.reset(speaker);
  cardSounds.reset(synth);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  herald.reset(null);
  cardSounds.reset(null);
});

const names: Record<string, string> = { p0: 'Amina', p1: 'Yusuf', p2: 'Layla' };
const name = (id: string) => names[id] ?? id;

describe('herald lines', () => {
  it('speaks turns, calls, snaps, and results, from public events only', () => {
    const pub = { cardId: 'c1', face: { rank: '5', suit: 'hearts' } } as const;
    const lines: [CambioEvent, string | null][] = [
      [{ type: 'turnStarted', playerId: 'p1' }, theme.herald.turn('Yusuf')],
      [{ type: 'cambioCalled', playerId: 'p0' }, theme.herald.called('Amina')],
      [
        { type: 'snapped', snapperId: 'p2', ownerId: 'p1', slotId: 's', card: pub, give: null },
        theme.herald.snapped('Layla'),
      ],
      [
        {
          type: 'snapFailed',
          snapperId: 'p1',
          ownerId: 'p1',
          slotId: 's',
          card: pub,
          penalty: null,
        },
        theme.herald.wrongSnap('Yusuf'),
      ],
      [{ type: 'gameOver', winners: ['p0'], totals: {} }, theme.herald.gameWinner(['Amina'])],
      [{ type: 'drew', playerId: 'p0', cardId: 'c9' }, null],
      [{ type: 'ready', playerId: 'p0' }, null],
    ];
    for (const [e, line] of lines) expect(cambioHeraldLine(e, name)).toBe(line);
    const result = {
      round: 1,
      callerId: 'p0',
      hands: [],
      scores: { p0: 9, p1: 4 },
      winners: ['p1'],
      totals: {},
    };
    expect(cambioHeraldLine({ type: 'roundRevealed', result }, name)).toBe(
      theme.herald.roundWinner(['Yusuf'], 4),
    );
  });
});

const room = (view: CambioHostView): LobbyView => ({
  code: 'BCDF',
  gameId: 'cambio',
  gameName: theme.title,
  minPlayers: 2,
  maxPlayers: 12,
  phase: 'playing',
  players: view.players.map((p) => ({
    id: p.id,
    name: p.name,
    connected: true,
    isVip: false,
    isBot: false,
    awayLong: false,
  })),
  tutorial: null,
  options: { ...view.options },
});

function renderTv(view: CambioHostView) {
  const ui = (v: CambioHostView) => (
    <MemoryRouter>
      <CambioTv room={room(v)} game={v} />
    </MemoryRouter>
  );
  const r = render(ui(view));
  return (v: CambioHostView) => r.rerender(ui(v));
}

describe('narration and card sounds', () => {
  it('stay silent until the enable tap, but captions always show', () => {
    const f = buildFixture('snap', 6);
    const rerender = renderTv(f.before.host);
    rerender(f.steps[0]!.host);
    expect(screen.getByTestId('caption').textContent).toBe(theme.herald.snapped('Yusuf'));
    expect(spoken).toEqual([]);
    cardSounds.play('snap');
    expect(played).toEqual([]);
  });

  it('one tap in the lobby turns on both, and says so', () => {
    render(<CambioLobbyExtras />);
    fireEvent.click(screen.getByRole('button', { name: theme.tv.heraldEnable }));
    expect(spoken).toEqual([theme.herald.ready]);
    expect(resumed).toBe(1);
    cardSounds.play('flip');
    expect(played).toEqual(['flip']);
    expect(screen.getByText(theme.tv.heraldReady)).toBeTruthy();
  });

  it('muting narration keeps the card sounds, and muting sounds keeps narration', () => {
    act(() => herald.enable(theme.herald.ready));
    spoken = [];
    act(() => herald.setMuted(true));
    herald.say('hello');
    cardSounds.play('deal');
    expect(spoken).toEqual([]);
    expect(played).toEqual(['deal']);

    act(() => herald.setMuted(false));
    act(() => cardSounds.setMuted(true));
    herald.say('hello');
    cardSounds.play('deal');
    expect(spoken).toEqual(['hello']);
    expect(played).toEqual(['deal']);
    // The sound mute is remembered for next time.
    cardSounds.reset({ play: (s) => void played.push(s), resume: () => undefined });
    expect(cardSounds.get().muted).toBe(true);
  });

  it('the gear menu can turn them on and mute the sounds', () => {
    renderTv(buildFixture('draw', 6).before.host);
    fireEvent.click(screen.getByRole('button', { name: theme.tv.settings }));
    fireEvent.click(screen.getByRole('button', { name: theme.tv.heraldEnable }));
    expect(herald.get().enabled).toBe(true);
    fireEvent.click(screen.getByLabelText(theme.tv.soundMute));
    expect(cardSounds.get().muted).toBe(true);
  });

  it('plays the TV sounds in time with each move', () => {
    const f = buildFixture('snapGive', 6);
    const { step } = applyEvent(sceneFromView(f.before.host), f.steps[0]!.events[0]!);
    expect(cuesFor(step)).toEqual([
      { sound: 'snap', at: timing.snapFlight },
      { sound: 'slide', at: timing.snapFlight - 80 },
    ]);
    const deal = buildFixture('deal', 12);
    const dealt = deal.steps[0]!.events.find((e) => e.type === 'dealt')!;
    const dealStep = applyEvent(sceneFromView(deal.before.host), dealt).step;
    const ticks = cuesFor(dealStep).filter((c) => c.sound === 'deal');
    expect(ticks.length).toBeGreaterThan(8);
    expect(ticks.length).toBeLessThanOrEqual(16);
    const wrong = buildFixture('wrongSnap', 6);
    const wrongStep = applyEvent(sceneFromView(wrong.before.host), wrong.steps[0]!.events[0]!).step;
    expect(cuesFor(wrongStep).map((c) => c.sound)).toEqual(['flip', 'wrong', 'deal']);
  });
});
