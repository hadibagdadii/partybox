import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';
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
