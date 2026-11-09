import type { AckResult, GameOption, HostViewMessage, LobbyView } from '@partybox/shared';
import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { JoinQr } from '../components/JoinQr';
import { OptionsPanel } from '../components/OptionsPanel';
import type { OptionField } from '../games/options';
import { gameScreens } from '../games/registry';
import { useJoinDisplayUrl } from '../lib/config';
import { joinPath, joinUrl } from '../lib/room-code';
import { getSocket, useConnected, useOnConnect } from '../lib/socket';
import { hostSession, type HostSession } from '../lib/storage';
import { Wordmark } from '../platform/Mark';
import { partybox } from '../platform/theme';
import { pbButton } from '../platform/ui';

const h = partybox.host;

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
        <Wordmark size="xl" />
        <h1 className="text-5xl font-extrabold [font-stretch:115%]">{h.title}</h1>
        {session ? (
          <p className="text-3xl text-pb-lavender">{h.reconnectingTo(session.code)}</p>
        ) : (
          <button
            type="button"
            onClick={createRoom}
            disabled={!connected}
            className={`${pbButton('primary')} !w-auto !min-h-20 rounded-[24px] px-14 !text-4xl`}
          >
            {h.create}
          </button>
        )}
        {error && <ErrorLine>{error}</ErrorLine>}
        {!connected && <p className="text-2xl text-pb-lavender">{h.connecting}</p>}
      </Screen>
    );
  }

  const screens = gameScreens[view.room.gameId];
  const GameHost = (debug && screens?.HostDebug) || screens?.Host;
  const playing = view.room.phase !== 'lobby' && !!GameHost;
  const endGame = () => {
    setError(null);
    socket.emit('game:end', {}, (result) => {
      if (!result.ok) setError(result.error.message);
    });
  };

  const Tutorial =
    view.room.phase === 'lobby' && view.room.tutorial && !debug && screens?.HostTutorial;
  if (Tutorial) {
    return (
      <>
        <Tutorial room={view.room} game={null} newRoom={forget} />
        {!connected && <Reconnecting />}
      </>
    );
  }

  if (playing && screens?.hostFullScreen && !debug) {
    return (
      <>
        <GameHost room={view.room} game={view.game} newRoom={forget} endGame={endGame} />
        {!connected && <Reconnecting />}
      </>
    );
  }

  return (
    <Screen>
      {!connected && <Reconnecting />}
      {!playing || !GameHost ? (
        <Lobby
          room={view.room}
          games={view.games}
          Extras={screens?.HostLobbyExtras}
          optionFields={screens?.options}
        />
      ) : (
        <>
          <p className="absolute right-8 top-6 text-3xl font-extrabold tracking-[0.2em] text-pb-lavender">
            {view.room.code}
          </p>
          <WaitingOn room={view.room} ids={view.waitingOn} />
          <GameHost room={view.room} game={view.game} endGame={endGame} />
        </>
      )}
      <button
        type="button"
        onClick={forget}
        className="absolute bottom-6 left-8 min-h-12 rounded-[12px] px-3 text-lg text-pb-lavender underline underline-offset-4 hover:text-pb-paper"
      >
        {h.newRoom}
      </button>
      {error && (
        <div className="absolute bottom-20">
          <ErrorLine>{error}</ErrorLine>
        </div>
      )}
    </Screen>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="pb-shell relative flex min-h-dvh flex-col items-center justify-center gap-10 bg-pb-night p-12 font-card text-pb-paper">
      {children}
    </main>
  );
}

function Reconnecting() {
  return (
    <p
      role="status"
      className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-pb-danger px-6 py-2 font-card text-xl font-semibold text-white"
    >
      {h.reconnecting}
    </p>
  );
}

function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-2xl bg-pb-danger px-6 py-3 text-2xl text-white">
      {children}
    </p>
  );
}

/** Who the game is waiting on, flagging anyone whose phone has dropped. */
function WaitingOn({ room, ids }: { room: LobbyView; ids: string[] }) {
  if (ids.length === 0) return null;
  const waiting = room.players.filter((p) => ids.includes(p.id));
  return (
    <div className="flex flex-col items-center gap-2 text-2xl">
      <p className="text-pb-lavender">{h.waitingOn}</p>
      <ul className="flex flex-wrap justify-center gap-3">
        {waiting.map((p) => (
          <li key={p.id} className="rounded-xl bg-pb-dusk px-4 py-1">
            {p.name}
            {!p.connected && (
              <span className="ml-2 rounded bg-pb-danger px-2 text-base text-white">
                {h.disconnected}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Room code, QR, and the typed fallback, side by side so the QR stays big. */
function JoinPanel({ code }: { code: string }) {
  const displayUrl = useJoinDisplayUrl();
  const url = joinUrl(code);
  return (
    <div className="flex flex-wrap items-center justify-center gap-16">
      <div className="flex max-w-4xl flex-col items-center gap-6 text-center">
        <p className="text-3xl text-pb-lavender">{h.roomCode}</p>
        <p
          aria-label="Room code"
          className="text-[10rem] font-black leading-none tracking-[0.2em] text-pb-punch [font-stretch:115%]"
        >
          {code}
        </p>
        <p data-testid="join-fallback" className="text-3xl text-pb-lavender">
          {displayUrl ? (
            <>
              {h.orGoTo} <span className="font-semibold text-pb-paper">{displayUrl}</span>{' '}
              {h.andEnter} <span className="font-semibold text-pb-paper">{code}</span>
            </>
          ) : (
            <>
              {h.orGoTo}{' '}
              <span className="font-semibold text-pb-paper">
                {/* Long origins wrap before /play, never inside the code. */}
                {window.location.origin}
                <wbr />
                <span className="whitespace-nowrap">{joinPath(code)}</span>
              </span>
            </>
          )}
        </p>
      </div>
      <figure className="flex flex-col items-center gap-4">
        <div className="rounded-3xl bg-white p-3 shadow-2xl">
          <JoinQr url={url} className="block h-[min(24rem,40vh)] w-[min(24rem,40vh)]" />
        </div>
        <figcaption className="text-3xl font-semibold text-pb-paper">{h.scan}</figcaption>
      </figure>
    </div>
  );
}

function Lobby({
  room,
  games,
  Extras,
  optionFields,
}: {
  room: LobbyView;
  games: GameOption[];
  Extras?: ComponentType;
  optionFields?: OptionField[] | undefined;
}) {
  const socket = getSocket();
  const [botError, setBotError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
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

  const remove = (playerId: string) => {
    setBotError(null);
    setRemoving(null);
    socket.emit('room:kick', { playerId }, report);
  };
  const removingName = room.players.find((p) => p.id === removing)?.name;

  const pickGame = (gameId: string) => {
    setBotError(null);
    socket.emit('room:setGame', { gameId }, report);
  };

  const setOptions = (options: Record<string, unknown>) => {
    setBotError(null);
    socket.emit('room:setOptions', { options }, report);
  };

  return (
    <>
      <JoinPanel code={room.code} />
      {games.length > 1 && (
        <div role="radiogroup" aria-label={h.game} className="flex gap-3">
          {games.map((g) => (
            <button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={g.id === room.gameId}
              onClick={() => pickGame(g.id)}
              className={`min-h-14 rounded-2xl px-6 py-2 text-2xl font-bold transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none ${
                g.id === room.gameId ? 'bg-pb-punch text-pb-ink' : 'bg-pb-dusk hover:bg-pb-line'
              }`}
            >
              {g.name}
              <span className="ml-2 text-lg font-medium opacity-80">
                {g.minPlayers}–{g.maxPlayers} players
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="text-3xl text-pb-lavender">
        {room.gameName} · {h.players(room.players.length, room.maxPlayers)} ·{' '}
        {missing > 0 ? h.needMore(missing) : h.waitingForVip}
      </p>
      {Extras && <Extras />}
      {optionFields && room.options && (
        <OptionsPanel fields={optionFields} values={room.options} onChange={setOptions} />
      )}
      {botError && <ErrorLine>{botError}</ErrorLine>}
      <ul className="flex max-w-6xl flex-wrap justify-center gap-4">
        {room.players.map((p) => (
          <li
            key={p.id}
            className={`flex items-center gap-3 rounded-2xl py-3 pl-6 pr-3 text-3xl ${
              p.connected ? 'bg-pb-dusk' : 'bg-pb-night text-pb-lavender ring-1 ring-pb-line'
            }`}
          >
            {p.isVip && (
              <span role="img" aria-label={partybox.lobby.vip}>
                👑
              </span>
            )}
            {p.name}
            {p.isBot && <span className="rounded bg-pb-line px-2 text-base">{h.bot}</span>}
            {!p.connected && (
              <span className="rounded bg-pb-danger px-2 text-base text-white">
                {h.disconnected}
              </span>
            )}
            <button
              type="button"
              aria-label={h.remove(p.name)}
              onClick={() => setRemoving(p.id)}
              className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-pb-lavender hover:bg-pb-line"
            >
              <span aria-hidden>×</span>
            </button>
          </li>
        ))}
      </ul>
      {removing && removingName && (
        <div
          role="alertdialog"
          aria-label={h.removeConfirm(removingName)}
          className="flex items-center gap-4 rounded-2xl border border-pb-danger bg-pb-dusk px-6 py-4 text-2xl"
        >
          <span>{h.removeConfirm(removingName)}</span>
          <button
            type="button"
            onClick={() => remove(removing)}
            className="min-h-12 rounded-xl bg-pb-danger px-5 py-2 font-semibold text-white"
          >
            {h.removeYes}
          </button>
          <button
            type="button"
            onClick={() => setRemoving(null)}
            className="min-h-12 rounded-xl border border-pb-line px-5 py-2"
          >
            {h.cancel}
          </button>
        </div>
      )}
      {import.meta.env.DEV && (
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={addBot}
            className="rounded-xl border border-dashed border-pb-line px-5 py-2 text-xl text-pb-lavender"
          >
            Add bot (dev)
          </button>
          <button
            type="button"
            onClick={devStart}
            disabled={missing > 0}
            className="rounded-xl border border-dashed border-pb-line px-5 py-2 text-xl text-pb-lavender disabled:opacity-40"
          >
            Start (dev)
          </button>
          <a
            href={`/dev?code=${room.code}`}
            target="_blank"
            rel="noreferrer"
            className="text-xl text-pb-lavender underline"
          >
            Open /dev phones
          </a>
        </div>
      )}
    </>
  );
}
