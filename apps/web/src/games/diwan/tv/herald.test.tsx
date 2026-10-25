import { theme, type DiwanHostView, type LogEntry } from '@partybox/diwan';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nameLookup } from '../format';
import { playerView } from '../phone/fixtures';
import { DiwanTv } from './DiwanTv';
import { fixtureRoom, fixturePlayers, hostView, scenes } from './fixtures';
import { MAX_PENDING, herald, heraldLine, type Speaker } from './herald';

/** Records what would be spoken; each line "ends" only when the test says so. */
function fakeSpeaker() {
  const spoken: { text: string; voice: string | null }[] = [];
  const ends: (() => void)[] = [];
  const speaker: Speaker = {
    speak: (text, voice, onEnd) => {
      spoken.push({ text, voice });
      ends.push(onEnd);
    },
    cancel: vi.fn(),
    voices: () => [{ uri: 'v1', name: 'Herald', lang: 'en-GB' }],
    onVoicesChanged: () => () => undefined,
  };
  const finish = () => {
    act(() => ends.shift()?.());
  };
  return { speaker, spoken, finish, lines: () => spoken.map((s) => s.text) };
}

const name = nameLookup(fixturePlayers);

function renderTv(view: DiwanHostView) {
  const ui = (v: DiwanHostView) => <DiwanTv room={fixtureRoom(v)} game={v} />;
  const result = render(ui(view), { wrapper: MemoryRouter });
  return { rerender: (v: DiwanHostView) => result.rerender(ui(v)) };
}

const caption = () => screen.getByTestId('caption').textContent;
const enable = () => {
  fireEvent.click(screen.getByRole('button', { name: theme.tv.settings }));
  fireEvent.click(screen.getByRole('button', { name: theme.tv.heraldEnable }));
};

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

let fake: ReturnType<typeof fakeSpeaker>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('localStorage', memoryStorage());
  fake = fakeSpeaker();
  herald.reset(fake.speaker);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  herald.reset(null);
});

describe('herald', () => {
  it('stays silent until enabled, but always shows captions', () => {
    const { rerender } = renderTv(scenes.reveal.view);
    expect(caption()).toBe(theme.herald.night);
    rerender(scenes.voteReveal.before);
    rerender(scenes.voteReveal.view);
    expect(caption()).toBe(heraldLine(scenes.voteReveal.view.log.at(-1)!, name));
    expect(fake.spoken).toHaveLength(0);

    enable();
    expect(fake.lines()).toEqual([theme.tv.heraldReady]);
    fake.finish();
    rerender(scenes.enacted.view);
    expect(fake.lines().at(-1)).toBe(theme.herald.enacted(theme.decrees.loyal));
  });

  it('speaks the night line when the reveal starts', () => {
    act(() => herald.enable());
    fake.finish();
    renderTv(scenes.reveal.view);
    expect(fake.lines()).toEqual([theme.tv.heraldReady, theme.herald.night]);
  });

  it('only ever speaks lines built from public log entries', () => {
    act(() => herald.enable());
    const views: DiwanHostView[] = [
      scenes.vote.view,
      scenes.voteReveal.view,
      scenes.enacted.view,
      scenes.power.view,
      scenes.exile.view,
    ];
    // A player view with private fields must not change what is said.
    const leaky = playerView({
      ...scenes.exile.view,
      you: { id: 'p1', role: 'usurper', team: 'rebel', alive: true },
      knownRoles: { p1: 'usurper', p3: 'rebel' },
      hand: ['rebel', 'loyal'],
      secrets: [{ type: 'investigate', targetId: 'p4', team: 'loyal' }],
    });
    const { rerender } = renderTv(views[0]!);
    for (const v of [...views.slice(1), leaky, scenes.gameOver.view]) {
      rerender(v);
      for (let i = 0; i < 5; i++) fake.finish();
    }
    for (let i = 0; i < 10; i++) fake.finish();

    const allEntries: LogEntry[] = [...scenes.exile.view.log, ...scenes.gameOver.view.log];
    const allowed = new Set([
      theme.tv.heraldReady,
      theme.herald.night,
      ...allEntries.map((e) => heraldLine(e, name)).filter((l): l is string => l !== null),
    ]);
    expect(fake.spoken.length).toBeGreaterThan(1);
    for (const line of fake.lines()) {
      expect(allowed).toContain(line);
      expect(line).not.toContain(theme.roles.usurper);
      expect(line).not.toContain(theme.roles.loyal);
    }
  });

  it('says only the result and tally for a vote', () => {
    const entry: LogEntry = {
      type: 'votesRevealed',
      votes: { p1: 'yes', p2: 'yes', p3: 'no', p4: 'yes', p5: 'no', p6: 'yes', p7: 'no' },
      passed: true,
    };
    const line = heraldLine(entry, name);
    expect(line).toBe('The vote passes, four to three.');
    for (const p of fixturePlayers) expect(line).not.toContain(p.name);
    expect(heraldLine({ ...entry, passed: false }, name)).toBe('The vote fails, four to three.');
  });

  it('drops older lines so it never falls behind the game', () => {
    act(() => herald.enable());
    // "Ready" is still being spoken while a burst of four lines arrives.
    const burst: LogEntry[] = [
      { type: 'nominated', ameerId: 'p1', wazirId: 'p2' },
      { type: 'nominated', ameerId: 'p2', wazirId: 'p3' },
      { type: 'nominated', ameerId: 'p3', wazirId: 'p4' },
      { type: 'nominated', ameerId: 'p4', wazirId: 'p5' },
    ];
    const base = hostView({ log: [] });
    const { rerender } = renderTv(base);
    rerender({ ...base, log: burst });
    fake.finish();
    fake.finish();
    fake.finish();
    expect(MAX_PENDING).toBe(2);
    expect(fake.lines()).toEqual([
      theme.tv.heraldReady,
      theme.herald.nominated('Layla', 'Omar'),
      theme.herald.nominated('Omar', 'Zainab'),
    ]);
    expect(caption()).toBe(theme.herald.nominated('Omar', 'Zainab'));
  });

  it('can be muted, and remembers mute and voice', () => {
    const { rerender } = renderTv(scenes.voteReveal.before);
    enable();
    fake.finish();
    act(() => herald.setMuted(true));
    rerender(scenes.voteReveal.view);
    expect(fake.lines()).toEqual([theme.tv.heraldReady]);
    expect(caption()).toBe(heraldLine(scenes.voteReveal.view.log.at(-1)!, name));

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'v1' } });
    act(() => herald.reset(fake.speaker));
    expect(herald.get()).toEqual({ enabled: false, muted: true, voiceURI: 'v1' });

    act(() => {
      herald.setMuted(false);
      herald.enable();
    });
    expect(fake.spoken.at(-1)).toEqual({ text: theme.tv.heraldReady, voice: 'v1' });
  });
});
