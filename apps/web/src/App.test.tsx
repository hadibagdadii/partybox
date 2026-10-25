import type { HostViewMessage } from '@partybox/shared';
import { act, cleanup, render, screen } from '@testing-library/react';
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

  function sendHostView() {
    const view = scenes.nominate.view;
    const message: HostViewMessage = {
      room: fixtureRoom(view),
      games: [],
      waitingOn: ['p2'],
      game: view,
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

  it('keeps the debug host at ?debug=1 in dev', () => {
    withSession();
    renderAt('/host?debug=1');
    sendHostView();
    expect(screen.queryByTestId('tv-stage')).toBeNull();
    expect(screen.getByRole('heading', { name: /Diwan · Nomination/ })).toBeTruthy();
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
