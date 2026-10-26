import type { HostViewMessage, LobbyView, PlayerViewMessage } from '@partybox/shared';
import { theme } from '@partybox/diwan';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';
import { fixtureRoom, scenes } from './games/diwan/tv/fixtures';
import { resetConfigCache } from './lib/config';
import { getSocket } from './lib/socket';
import { parseSlot, playerTokenKey } from './lib/storage';
import { decodeQrSvg } from './test/decode-qr';

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
    expect(screen.getByRole('heading', { name: theme.landing.title })).toBeTruthy();
    expect(screen.getByText(theme.landing.pitch)).toBeTruthy();
    expect(screen.getByText(theme.landing.players)).toBe(screen.getByText('5 to 10 players'));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('sends hosts from the landing page to /host', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('link', { name: theme.landing.host }));
    expect(screen.getByRole('heading', { name: 'Host screen' })).toBeTruthy();
  });

  it('joins from the landing page with the typed code', () => {
    renderAt('/');
    const input = screen.getByLabelText<HTMLInputElement>('Room code');
    const join = screen.getByRole<HTMLButtonElement>('button', { name: theme.landing.joinButton });
    fireEvent.change(input, { target: { value: 'bc' } });
    expect(join.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'bc-df9' } });
    expect(input.value).toBe('BCDF');
    fireEvent.click(join);
    expect(screen.getByRole('heading', { name: 'Join a game' })).toBeTruthy();
    expect(screen.getByLabelText('Room code').textContent).toBe('BCDF');
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

  it('prefills the room code from ?code= and makes the name the only field', () => {
    renderAt('/play?code=bcdf');
    expect(screen.getByLabelText('Room code').textContent).toBe('BCDF');
    expect(document.activeElement).toBe(screen.getByLabelText('Your name'));
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByLabelText<HTMLInputElement>('Room code').value).toBe('BCDF');
  });

  it('asks for the code first without ?code=', () => {
    renderAt('/play');
    expect(screen.getByLabelText<HTMLInputElement>('Room code').value).toBe('');
    expect(document.activeElement).not.toBe(screen.getByLabelText('Your name'));
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
    expect(screen.getByRole('heading', { name: theme.landing.title })).toBeTruthy();
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

describe('remembered name', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubStorage(entries: [string, string][] = []) {
    const saved = new Map(entries);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => saved.get(k) ?? null,
      setItem: (k: string, v: string) => saved.set(k, v),
      removeItem: (k: string) => saved.delete(k),
    });
    return saved;
  }

  it('prefills the last name used', () => {
    stubStorage([['partybox:lastName', 'Amina']]);
    renderAt('/play?code=BCDF');
    expect(screen.getByLabelText<HTMLInputElement>('Your name').value).toBe('Amina');
  });

  it('remembers the name after a successful join', () => {
    const saved = stubStorage();
    renderAt('/play?code=BCDF');
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: '  Yusuf ' } });
    fireEvent.submit(screen.getByLabelText('Your name').closest('form')!);
    const emit = vi.mocked(getSocket().emit);
    const [event, payload, ack] = emit.mock.calls.at(-1) as unknown as [
      string,
      unknown,
      (r: unknown) => void,
    ];
    expect(event).toBe('room:join');
    expect(payload).toEqual({ code: 'BCDF', name: '  Yusuf ' });
    act(() => ack({ ok: true, code: 'BCDF', playerToken: '00000000-0000-4000-8000-000000000000' }));
    expect(saved.get('partybox:lastName')).toBe('Yusuf');
  });
});

describe('host lobby join panel', () => {
  function stubConfig(joinDisplayUrl: string | null) {
    resetConfigCache();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) =>
        k === 'partybox:host' ? JSON.stringify({ code: 'DMWN', hostToken: 't' }) : null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ joinDisplayUrl }) })),
    );
  }

  function sendLobby() {
    const room: LobbyView = { ...fixtureRoom(scenes.nominate.view), phase: 'lobby', code: 'DMWN' };
    const on = vi.mocked(getSocket().on);
    const handler = on.mock.calls.filter(([event]) => event === 'host:view').at(-1)?.[1] as (
      m: HostViewMessage,
    ) => void;
    act(() => handler({ room, games: [], waitingOn: [], game: null }));
  }

  afterEach(() => vi.unstubAllGlobals());

  it('shows a QR that scans to the exact join URL', () => {
    stubConfig(null);
    renderAt('/host');
    sendLobby();
    expect(screen.getByText('Scan to join')).toBeTruthy();
    const qr = screen.getByRole('img', { name: 'Scan to join' });
    expect(decodeQrSvg(qr)).toBe(`${window.location.origin}/play?code=DMWN`);
  });

  it('shows JOIN_DISPLAY_URL and the code when the server has one', async () => {
    stubConfig('party.example');
    renderAt('/host');
    sendLobby();
    const line = screen.getByTestId('join-fallback');
    await waitFor(() => expect(line.textContent).toBe('Or go to party.example and enter DMWN'));
    expect(fetch).toHaveBeenCalledWith('/api/config');
  });

  it('shows the real join URL when JOIN_DISPLAY_URL is unset', async () => {
    stubConfig(null);
    renderAt('/host');
    sendLobby();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByTestId('join-fallback').textContent).toBe(
      `Or go to ${window.location.origin}/play?code=DMWN`,
    );
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
