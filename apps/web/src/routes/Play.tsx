import { PLAYER_NAME_MAX, type PlayerViewMessage } from '@partybox/shared';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { gameScreens, type ActOptions, type ActResult } from '../games/registry';
import { getSocket, useConnected, useOnConnect } from '../lib/socket';
import { cleanCode, isFullCode } from '../lib/room-code';
import { lastName, parseSlot, playerToken, playerTokenKey } from '../lib/storage';
import { useWakeLock } from '../lib/wake-lock';
import { Mark } from '../platform/Mark';
import { partybox } from '../platform/theme';
import { pbButton, pbInput, PbPage } from '../platform/ui';

interface SeatRef {
  code: string;
  token: string;
}

/** Commands a seated phone sends with an empty payload. */
type SeatCommand =
  | 'game:start'
  | 'game:reset'
  | 'game:playAgain'
  | 'tutorial:start'
  | 'tutorial:skip'
  | 'room:leave';

const t = partybox.join;
const l = partybox.lobby;

export function Play() {
  const socket = getSocket();
  const connected = useConnected(socket);
  const [params, setParams] = useSearchParams();
  const slot = parseSlot(params.get('slot'));
  const urlCode = cleanCode(params.get('code') ?? '');

  const [code, setCode] = useState(urlCode);
  const [name, setName] = useState(() => lastName.get().slice(0, PLAYER_NAME_MAX));
  // A scanned or shared link already carries the code: show it, and just ask for a name.
  const [editingCode, setEditingCode] = useState(!isFullCode(urlCode));
  const [seat, setSeat] = useState<SeatRef | null>(() => {
    const token = isFullCode(urlCode) ? playerToken.get(urlCode, slot) : null;
    return token ? { code: urlCode, token } : null;
  });
  const [view, setView] = useState<PlayerViewMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState(false);
  const debug = import.meta.env.DEV && params.get('debug') === '1';
  useWakeLock(view?.room.phase === 'playing');

  // In-game errors are toasts; let them fade so they don't sit over the game.
  useEffect(() => {
    if (!error || !seat) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error, seat]);

  useEffect(() => {
    socket.on('player:view', setView);
    return () => {
      socket.off('player:view', setView);
    };
  }, [socket]);

  /** The seat is gone for good: forget the token so a refresh doesn't try to reclaim it. */
  const dropSeat = useCallback(
    (code: string, wasRemoved: boolean) => {
      playerToken.clear(code, slot);
      setSeat(null);
      setView(null);
      setRemoved(wasRemoved);
    },
    [slot],
  );

  useEffect(() => {
    if (!seat) return;
    const onRemoved = () => dropSeat(seat.code, true);
    socket.on('player:removed', onRemoved);
    return () => {
      socket.off('player:removed', onRemoved);
    };
  }, [socket, seat, dropSeat]);

  // Reclaim the seat after a refresh, screen lock, or dropped connection.
  const resume = useCallback(() => {
    if (!seat) return;
    socket.emit('player:resume', { code: seat.code, playerToken: seat.token }, (result) => {
      if (result.ok) return;
      const wasRemoved = result.error.code === 'removed';
      dropSeat(seat.code, wasRemoved);
      if (!wasRemoved) setError(result.error.message);
    });
  }, [socket, seat, dropSeat]);
  useOnConnect(socket, seat ? resume : null);

  const join = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    socket.emit('room:join', { code, name }, (result) => {
      setBusy(false);
      if (!result.ok) return setError(result.error.message);
      playerToken.set(result.code, slot, result.playerToken);
      lastName.set(name.trim());
      // Keep the code in the URL so a refresh finds the stored token.
      setParams(slot ? { code: result.code, slot } : { code: result.code }, { replace: true });
      setSeat({ code: result.code, token: result.playerToken });
    });
  };

  const send = (event: SeatCommand) => {
    setError(null);
    socket.emit(event, {}, (result) => {
      if (!result.ok) setError(result.error.message);
    });
  };

  const step = (dir: 'next' | 'back') => {
    setError(null);
    socket.emit('tutorial:step', { dir }, (result) => {
      if (!result.ok) setError(result.error.message);
    });
  };

  const act = (action: unknown, opts: ActOptions = {}) =>
    new Promise<ActResult>((resolve) => {
      setError(null);
      socket.emit('game:action', { action }, (result) => {
        // A quiet action's screen shows its own message for a failure.
        if (!result.ok && !opts.quiet) setError(result.error.message);
        resolve(result.ok ? { ok: true } : { ok: false, error: result.error });
      });
    });

  if (seat) {
    const screens = view ? gameScreens[view.room.gameId] : undefined;
    const ownsViewport =
      !!view &&
      !debug &&
      ((view.room.phase === 'lobby' &&
        (!!screens?.Lobby || (!!view.room.tutorial && !!screens?.Tutorial))) ||
        (view.room.phase !== 'lobby' && !!screens?.fullScreen));
    const seated = view && (
      <Seated
        view={view}
        act={act}
        send={send}
        step={step}
        seatKey={playerTokenKey(seat.code, slot)}
        debug={debug}
      />
    );
    return (
      <>
        {!connected && <Banner>{t.reconnecting}</Banner>}
        {error && ownsViewport && <Toast>{error}</Toast>}
        {ownsViewport ? (
          seated
        ) : (
          <Screen>
            {seated ?? (
              <p className="text-center text-xl text-pb-lavender">{t.rejoining(seat.code)}</p>
            )}
            {error && <ErrorText>{error}</ErrorText>}
          </Screen>
        )}
      </>
    );
  }

  if (removed) {
    return (
      <Screen>
        <Mark size={72} className="mx-auto" />
        <p
          role="status"
          className="text-center text-3xl font-extrabold [font-stretch:110%] [text-wrap:balance]"
        >
          {t.removed}
        </p>
        <BigButton
          onClick={() => {
            setRemoved(false);
            setParams(slot ? { slot } : {}, { replace: true });
          }}
        >
          {t.joinAnother}
        </BigButton>
        <Link
          to="/about"
          className="min-h-12 self-center py-3 text-lg text-pb-lavender underline underline-offset-4"
        >
          {t.about}
        </Link>
      </Screen>
    );
  }

  const canJoin = isFullCode(code) && name.trim().length > 0 && connected && !busy;
  return (
    <Screen>
      <Link to="/" aria-label={partybox.name} className="mx-auto rounded-full">
        <Mark size={72} />
      </Link>
      <h1 className="text-center text-4xl font-extrabold [font-stretch:115%]">{t.title}</h1>
      <form onSubmit={join} className="flex flex-col gap-4">
        {editingCode ? (
          <label className="flex flex-col gap-2">
            <span className="text-lg text-pb-lavender">{t.code}</span>
            <input
              value={code}
              onChange={(e) => setCode(cleanCode(e.target.value))}
              autoFocus={isFullCode(urlCode)}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              placeholder="BCDF"
              className={`${pbInput} min-h-16 bg-pb-dusk text-center text-4xl font-extrabold uppercase tracking-[0.4em]`}
            />
          </label>
        ) : (
          <p className="flex min-h-12 items-center justify-center gap-3 text-xl text-pb-lavender">
            <span>
              {t.room}{' '}
              <span aria-label={t.code} className="font-extrabold tracking-[0.3em] text-pb-paper">
                {code}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setEditingCode(true)}
              className="min-h-12 rounded-[12px] px-2 text-lg text-pb-punch underline underline-offset-4"
            >
              {t.change}
            </button>
          </p>
        )}
        <label className="flex flex-col gap-2">
          <span className="text-lg text-pb-lavender">{t.name}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, PLAYER_NAME_MAX))}
            maxLength={PLAYER_NAME_MAX}
            autoComplete="nickname"
            autoFocus={!editingCode}
            className={`${pbInput} min-h-16 bg-pb-dusk text-2xl`}
          />
        </label>
        <button
          type="submit"
          disabled={!canJoin}
          className={`${pbButton('primary')} min-h-16 text-2xl`}
        >
          {busy ? t.joining : t.join}
        </button>
      </form>
      {error && <ErrorText>{error}</ErrorText>}
      {!connected && <p className="text-center text-pb-lavender">{t.connecting}</p>}
    </Screen>
  );
}

function Seated({
  view,
  act,
  send,
  step,
  seatKey,
  debug,
}: {
  view: PlayerViewMessage;
  act: (action: unknown, opts?: ActOptions) => Promise<ActResult>;
  send: (event: SeatCommand) => void;
  step: (dir: 'next' | 'back') => void;
  seatKey: string;
  debug: boolean;
}) {
  const { room, you } = view;
  const screens = gameScreens[room.gameId];
  const over = room.phase === 'over' && you.isVip;
  const reset = over ? () => send('game:reset') : null;
  const playAgain = over ? () => send('game:playAgain') : null;

  if (room.phase !== 'lobby' && screens) {
    const GamePlayer = (debug && screens.Debug) || screens.Player;
    const props = { room, you, game: view.game, act, seatKey, reset, playAgain };
    if (screens.fullScreen && !debug) return <GamePlayer {...props} />;
    return (
      <>
        <Header view={view} />
        <GamePlayer {...props} />
        {playAgain && <BigButton onClick={playAgain}>{l.playAgain}</BigButton>}
        {reset && (
          <BigButton tone="quiet" onClick={reset}>
            {l.backToLobby}
          </BigButton>
        )}
      </>
    );
  }

  if (room.tutorial && screens?.Tutorial && !debug) {
    return (
      <screens.Tutorial room={room} you={you} step={step} skip={() => send('tutorial:skip')} />
    );
  }

  if (screens?.Lobby && !debug) {
    return (
      <screens.Lobby
        room={room}
        you={you}
        canStart={view.canStart}
        start={() => send('game:start')}
        startTutorial={screens.Tutorial ? () => send('tutorial:start') : undefined}
        leave={() => send('room:leave')}
      />
    );
  }

  const missing = room.minPlayers - room.players.length;
  const tutorial = screens?.Tutorial ? () => send('tutorial:start') : null;
  return (
    <>
      <Header view={view} />
      <h1 className="text-center text-4xl font-extrabold [font-stretch:115%]">{l.youreIn}</h1>
      <p className="text-center text-xl text-pb-lavender">
        {room.gameName} · {l.joined(room.players.length)}
        {missing > 0 && ` · ${l.needMore(missing)}`}
      </p>
      {view.canStart ? (
        <div className="flex flex-col gap-3">
          {tutorial && <BigButton onClick={tutorial}>{l.startWithTutorial}</BigButton>}
          <BigButton tone={tutorial ? 'secondary' : 'primary'} onClick={() => send('game:start')}>
            {tutorial ? l.startNow : l.start}
          </BigButton>
        </div>
      ) : (
        <p className="text-center text-xl text-pb-lavender">
          {you.isVip ? l.waitingForMore : l.waitingForVip}
        </p>
      )}
      <button
        type="button"
        onClick={() => send('room:leave')}
        className="min-h-12 self-center rounded-[12px] px-3 text-center text-lg text-pb-lavender underline underline-offset-4"
      >
        {l.leave}
      </button>
    </>
  );
}

function Header({ view }: { view: PlayerViewMessage }) {
  return (
    <p className="flex items-center justify-center gap-2 text-center text-lg text-pb-lavender">
      {view.you.isVip && (
        <span className="rounded-full bg-pb-punch px-2 py-0.5 text-sm font-bold text-pb-ink">
          {l.vip}
        </span>
      )}
      {view.you.name} ·{' '}
      <span className="font-bold tracking-[0.2em] text-pb-paper">{view.room.code}</span>
    </p>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <PbPage>
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-safe pb-safe pt-safe">
        {children}
      </main>
    </PbPage>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-[14px] bg-pb-danger px-4 py-3 text-center text-lg text-white"
    >
      {children}
    </p>
  );
}

/** Pinned to the top, inside the notch, while the socket is down. */
function Banner({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="fixed inset-x-0 top-0 z-[200] bg-pb-danger px-4 pb-1.5 pt-[max(env(safe-area-inset-top),0.375rem)] text-center font-card text-sm font-semibold text-white shadow-lg"
    >
      {children}
    </p>
  );
}

function Toast({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="pointer-events-none fixed inset-x-4 top-[calc(max(env(safe-area-inset-top),0.75rem)+4rem)] z-[200] mx-auto max-w-md rounded-[16px] bg-pb-danger px-4 py-3 text-center font-card text-lg text-white shadow-lg"
    >
      {children}
    </p>
  );
}

function BigButton({
  onClick,
  children,
  tone = 'primary',
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: 'primary' | 'secondary' | 'quiet';
}) {
  return (
    <button type="button" onClick={onClick} className={`${pbButton(tone)} min-h-16 text-2xl`}>
      {children}
    </button>
  );
}
