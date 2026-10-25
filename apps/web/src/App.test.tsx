import type { HostViewMessage, LobbyView, PlayerViewMessage } from '@partybox/shared';
import { theme } from '@partybox/diwan';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';
import { fixtureRoom, scenes } from './games/diwan/tv/fixtures';
import { getSocket } from './lib/socket';
import { parseSlot, playerTokenKey } from './lib/storage';

// Pages talk to the server through this module; keep tests offline.
vi.mock('./lib/socket', () => {
  const socket = { connected: false, on: vi.fn(), off: vi.fn(), emit: vi.fn(), connect: vi.fn() };
  return { getSocket: () => socket, useConnected: () => false, useOnConnect: () => undefined };
});

function renderAt(path: string) {
  render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AppRoutes />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('AppRoutes', () => {
  it('renders the landing page at /', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Partybox' })).toBeTruthy();
  });

  it('renders the host screen with a create button at /host', () => {
    renderAt('/host');
    expect(screen.getByRole('heading', { name: 'Host screen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create room' })).toBeTruthy();
  });

  it('renders the join form at /play', () => {
    renderAt('/play');
    expect(screen.getByRole('heading', { name: 'Join a game' })).toBeTruthy();
  });

  it('prefills the room code from ?code=', () => {
    renderAt('/play?code=bcdf');
    expect(screen.getByLabelText<HTMLInputElement>('Room code').value).toBe('BCDF');
  });

  it('links to About from the landing page', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('link', { name: 'About' }));
    expect(screen.getByText(theme.about.attribution)).toBeTruthy();
  });

  it('shows the attribution and license at /about, and Back goes home with no history', () => {
    renderAt('/about');
    expect(screen.getByRole('heading', { name: theme.about.title })).toBeTruthy();
    expect(screen.getByText(theme.about.attribution)).toBeTruthy();
    const link = screen.getByRole('link', { name: theme.about.licenseLink });
    expect(link.getAttribute('href')).toBe(theme.about.licenseUrl);
    expect(screen.getByText(theme.about.licenseFile)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: theme.about.back }));
    expect(screen.getByRole('heading', { name: 'Partybox' })).toBeTruthy();
  });

  it('renders one iframe per slot at /dev', () => {
    renderAt('/dev?code=BCDF&n=3');
    const frames = screen.getAllByTitle(/^Phone \d$/);
    expect(frames.map((f) => f.getAttribute('src'))).toEqual([
      '/play?slot=1&code=BCDF',
      '/play?slot=2&code=BCDF',
      '/play?slot=3&code=BCDF',
    ]);
  });
});

describe('Diwan host screen', () => {
  // Node's own localStorage shadows jsdom's here; give the host a saved session.
  function withSession() {
    const saved = new Map([['partybox:host', JSON.stringify({ code: 'DMWN', hostToken: 't' })]]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => saved.get(k) ?? null,
      setItem: (k: string, v: string) => saved.set(k, v),
      removeItem: (k: string) => saved.delete(k),
    });
  }

  function sendHostView(tutorial: LobbyView['tutorial'] = null) {
    const view = scenes.nominate.view;
    const message: HostViewMessage = {
      room: tutorial ? { ...fixtureRoom(view), phase: 'lobby', tutorial } : fixtureRoom(view),
      games: [],
      waitingOn: ['p2'],
      game: tutorial ? null : view,
    };
    const on = vi.mocked(getSocket().on);
    const handler = on.mock.calls.filter(([event]) => event === 'host:view').at(-1)?.[1] as (
      m: HostViewMessage,
    ) => void;
    act(() => handler(message));
  }

  afterEach(() => vi.unstubAllGlobals());

  it('shows the TV by default', () => {
    withSession();
    renderAt('/host');
    sendHostView();
    expect(screen.getByTestId('tv-stage')).toBeTruthy();
  });

  it('shows the tutorial slide the room is on', () => {
    withSession();
    renderAt('/host');
    sendHostView({ slide: 4, total: 7 });
    expect(screen.getByRole('heading', { name: theme.tutorial.slides[4]!.title })).toBeTruthy();
  });

  it('keeps the debug host at ?debug=1 in dev', () => {
    withSession();
    renderAt('/host?debug=1');
    sendHostView();
    expect(screen.queryByTestId('tv-stage')).toBeNull();
    expect(screen.getByRole('heading', { name: /Diwan · Nomination/ })).toBeTruthy();
  });
});

describe('removed phone', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the removal message and forgets its token', () => {
    const saved = new Map([['partybox:BCDF', '00000000-0000-4000-8000-000000000000']]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => saved.get(k) ?? null,
      setItem: (k: string, v: string) => saved.set(k, v),
      removeItem: (k: string) => saved.delete(k),
    });
    renderAt('/play?code=BCDF');
    const on = vi.mocked(getSocket().on);
    const handler = (event: string) =>
      on.mock.calls.filter(([e]) => e === event).at(-1)?.[1] as (...args: unknown[]) => void;
    const view: PlayerViewMessage = {
      room: { ...fixtureRoom(scenes.nominate.view), phase: 'lobby', code: 'BCDF' },
      you: { id: 'p2', name: 'Yusuf', isVip: false },
      canStart: false,
      game: null,
    };
    act(() => handler('player:view')(view));
    act(() => handler('player:removed')());
    expect(screen.getByRole('status').textContent).toBe('You were removed from the room');
    expect(saved.has('partybox:BCDF')).toBe(false);
  });
});

describe('player token keys', () => {
  it('namespaces by slot', () => {
    expect(playerTokenKey('BCDF', null)).toBe('partybox:BCDF');
    expect(playerTokenKey('BCDF', '3')).toBe('partybox:BCDF:slot3');
  });

  it('ignores junk slot values', () => {
    expect(parseSlot('3')).toBe('3');
    expect(parseSlot('../x')).toBeNull();
    expect(parseSlot(null)).toBeNull();
  });
});
