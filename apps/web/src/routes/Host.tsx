import type { AckResult, GameOption, HostViewMessage, LobbyView } from '@partybox/shared';
import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { gameScreens } from '../games/registry';
import { getSocket, useConnected, useOnConnect } from '../lib/socket';
import { hostSession, type HostSession } from '../lib/storage';

export function Host() {
  const socket = getSocket();
  const connected = useConnected(socket);
  const [params] = useSearchParams();
  const debug = import.meta.env.DEV && params.get('debug') === '1';
  const [session, setSession] = useState<HostSession | null>(() => hostSession.get());
  const [view, setView] = useState<HostViewMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    socket.on('host:view', setView);
    return () => {
      socket.off('host:view', setView);
    };
  }, [socket]);

  const forget = useCallback(() => {
    hostSession.clear();
    setSession(null);
    setView(null);
  }, []);

  // Reclaim the room after a TV refresh or dropped connection.
  const resume = useCallback(() => {
    if (!session) return;
    socket.emit('host:resume', session, (result) => {
      if (!result.ok) {
        forget();
        setError(result.error.message);
      }
    });
  }, [socket, session, forget]);
  useOnConnect(socket, session ? resume : null);

  const createRoom = () => {
    setError(null);
    socket.emit('room:create', {}, (result) => {
      if (!result.ok) return setError(result.error.message);
      const next = { code: result.code, hostToken: result.hostToken };
      hostSession.set(next);
      setSession(next);
    });
  };

  if (!session || !view) {
    return (
      <Screen>
        <h1 className="text-7xl font-bold tracking-tight">Host screen</h1>
        {session ? (
          <p className="text-3xl text-slate-400">Reconnecting to {session.code}…</p>
        ) : (
          <button
            type="button"
            onClick={createRoom}
            disabled={!connected}
            className="rounded-3xl bg-amber-500 px-12 py-6 text-4xl font-semibold text-slate-950 disabled:opacity-50"
          >
            Create room
          </button>
        )}
        {error && <p className="text-2xl text-red-400">{error}</p>}
        {!connected && <p className="text-2xl text-slate-500">Connecting to server…</p>}
      </Screen>
    );
  }

  const screens = gameScreens[view.room.gameId];
  const GameHost = (debug && screens?.HostDebug) || screens?.Host;
  const playing = view.room.phase !== 'lobby' && !!GameHost;

  if (playing && screens?.hostFullScreen && !debug) {
    return (
      <>
        <GameHost room={view.room} game={view.game} newRoom={forget} />
        {!connected && (
          <p className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-red-900 px-6 py-2 text-xl text-white">
            Reconnecting…
          </p>
        )}
      </>
    );
  }

  return (
    <Screen>
      {!connected && (
        <p className="absolute top-6 rounded-full bg-red-900 px-6 py-2 text-xl">Reconnecting…</p>
      )}
      {!playing || !GameHost ? (
        <Lobby room={view.room} games={view.games} Extras={screens?.HostLobbyExtras} />
      ) : (
        <>
          <p className="absolute right-8 top-6 text-3xl font-bold tracking-widest text-slate-500">
            {view.room.code}
          </p>
          <WaitingOn room={view.room} ids={view.waitingOn} />
          <GameHost room={view.room} game={view.game} />
        </>
      )}
      <button
        type="button"
        onClick={forget}
        className="absolute bottom-6 left-8 text-lg text-slate-600 hover:text-slate-400"
      >
        New room
      </button>
    </Screen>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-10 bg-slate-950 p-12 text-slate-100">
      {children}
    </main>
  );
}

function joinUrl(code: string): string {
  const base = import.meta.env.VITE_PUBLIC_URL ?? window.location.origin;
  return `${base.replace(/\/$/, '')}/play?code=${code}`;
}

/** Who the game is waiting on, flagging anyone whose phone has dropped. */
function WaitingOn({ room, ids }: { room: LobbyView; ids: string[] }) {
  if (ids.length === 0) return null;
  const waiting = room.players.filter((p) => ids.includes(p.id));
  return (
    <div className="flex flex-col items-center gap-2 text-2xl">
      <p className="text-slate-400">Waiting on</p>
      <ul className="flex flex-wrap justify-center gap-3">
        {waiting.map((p) => (
          <li key={p.id} className="rounded-xl bg-slate-800 px-4 py-1">
            {p.name}
            {!p.connected && (
              <span className="ml-2 rounded bg-red-900 px-2 text-base text-red-100">
                disconnected
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Lobby({
  room,
  games,
  Extras,
}: {
  room: LobbyView;
  games: GameOption[];
  Extras?: ComponentType;
}) {
  const socket = getSocket();
  const [botError, setBotError] = useState<string | null>(null);
  const missing = room.minPlayers - room.players.length;

  const report = (result: AckResult<object>) => {
    if (!result.ok) setBotError(result.error.message);
  };
  const addBot = () => {
    setBotError(null);
    socket.emit('dev:addBot', {}, report);
  };
  const devStart = () => {
    setBotError(null);
    socket.emit('dev:start', {}, report);
  };

  const pickGame = (gameId: string) => {
    setBotError(null);
    socket.emit('room:setGame', { gameId }, report);
  };

  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <p className="text-3xl text-slate-400">Join at</p>
        <p className="text-4xl font-semibold">{joinUrl(room.code)}</p>
      </div>
      <p
        aria-label="Room code"
        className="text-[12rem] font-black leading-none tracking-[0.2em] text-amber-400"
      >
        {room.code}
      </p>
      {games.length > 1 && (
        <div role="radiogroup" aria-label="Game" className="flex gap-3">
          {games.map((g) => (
            <button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={g.id === room.gameId}
              onClick={() => pickGame(g.id)}
              className={`rounded-xl px-5 py-2 text-2xl ${
                g.id === room.gameId ? 'bg-amber-500 text-slate-950' : 'bg-slate-800'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}
      <p className="text-3xl text-slate-400">
        {room.gameName} · {room.players.length}/{room.maxPlayers} players
        {missing > 0 ? ` · need ${missing} more` : ' · waiting for the VIP to start'}
      </p>
      {Extras && <Extras />}
      <ul className="flex max-w-6xl flex-wrap justify-center gap-4">
        {room.players.map((p) => (
          <li
            key={p.id}
            className={`flex items-center gap-3 rounded-2xl px-6 py-3 text-3xl ${
              p.connected ? 'bg-slate-800' : 'bg-slate-900 text-slate-500'
            }`}
          >
            {p.isVip && <span title="VIP">👑</span>}
            {p.name}
            {p.isBot && <span className="rounded bg-slate-700 px-2 text-base">bot</span>}
            {!p.connected && (
              <span className="rounded bg-red-900 px-2 text-base text-red-100">disconnected</span>
            )}
          </li>
        ))}
      </ul>
      {import.meta.env.DEV && (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={addBot}
            className="rounded-xl border border-dashed border-slate-600 px-5 py-2 text-xl text-slate-400"
          >
            Add bot (dev)
          </button>
          <button
            type="button"
            onClick={devStart}
            disabled={missing > 0}
            className="rounded-xl border border-dashed border-slate-600 px-5 py-2 text-xl text-slate-400 disabled:opacity-40"
          >
            Start (dev)
          </button>
          <a
            href={`/dev?code=${room.code}`}
            target="_blank"
            rel="noreferrer"
            className="text-xl text-slate-500 underline"
          >
            Open /dev phones
          </a>
          {botError && <span className="text-xl text-red-400">{botError}</span>}
        </div>
      )}
    </>
  );
}
