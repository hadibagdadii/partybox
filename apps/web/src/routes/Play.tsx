import {
  PLAYER_NAME_MAX,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type PlayerViewMessage,
} from '@partybox/shared';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LatticeBackground, Rosette12 } from '../games/diwan/ornaments';
import { gameScreens } from '../games/registry';
import { getSocket, useConnected, useOnConnect } from '../lib/socket';
import { parseSlot, playerToken, playerTokenKey } from '../lib/storage';
import { useWakeLock } from '../lib/wake-lock';

const notInAlphabet = new RegExp(`[^${ROOM_CODE_ALPHABET}]`, 'g');
const cleanCode = (raw: string) =>
  raw.toUpperCase().replace(notInAlphabet, '').slice(0, ROOM_CODE_LENGTH);

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

const REMOVED_MESSAGE = 'You were removed from the room';

export function Play() {
  const socket = getSocket();
  const connected = useConnected(socket);
  const [params, setParams] = useSearchParams();
  const slot = parseSlot(params.get('slot'));
  const urlCode = cleanCode(params.get('code') ?? '');

  const [code, setCode] = useState(urlCode);
  const [name, setName] = useState('');
  const [seat, setSeat] = useState<SeatRef | null>(() => {
    const token = urlCode.length === ROOM_CODE_LENGTH ? playerToken.get(urlCode, slot) : null;
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

  const act = (action: unknown) =>
    new Promise<void>((resolve) => {
      setError(null);
      socket.emit('game:action', { action }, (result) => {
        if (!result.ok) setError(result.error.message);
        resolve();
      });
    });

  if (seat) {
    const screens = view ? gameScreens[view.room.gameId] : undefined;
    const ownsViewport =
      !!view &&
      !debug &&
      ((view.room.phase === 'lobby' && !!screens?.Lobby) ||
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
        {!connected && <Banner>Reconnecting…</Banner>}
        {error && ownsViewport && <Toast>{error}</Toast>}
        {ownsViewport ? (
          seated
        ) : (
          <Screen>
            {seated ?? (
              <p className="text-center text-xl text-court-mist">Rejoining {seat.code}…</p>
            )}
            {error && <p className="text-center text-lg text-red-400">{error}</p>}
          </Screen>
        )}
      </>
    );
  }

  if (removed) {
    return (
      <Screen>
        <Rosette12 size={96} className="mx-auto text-court-gold" />
        <p role="status" className="text-center font-display text-4xl text-court-goldLight">
          {REMOVED_MESSAGE}
        </p>
        <BigButton
          onClick={() => {
            setRemoved(false);
            setParams(slot ? { slot } : {}, { replace: true });
          }}
        >
          Join a game
        </BigButton>
        <Link to="/about" className="text-center text-lg text-court-mist underline">
          About
        </Link>
      </Screen>
    );
  }

  const canJoin = code.length === ROOM_CODE_LENGTH && name.trim().length > 0 && connected && !busy;
  return (
    <Screen>
      <Rosette12 size={96} className="mx-auto text-court-gold motion-safe:animate-spin-slow" />
      <h1 className="text-center font-display text-5xl text-court-goldLight">Join a game</h1>
      <form onSubmit={join} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-lg text-court-mist">Room code</span>
          <input
            value={code}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            placeholder="BCDF"
            className="min-h-16 w-full min-w-0 rounded-button border border-court-gold/40 bg-court-dusk px-4 text-center text-4xl font-bold uppercase tracking-[0.4em] text-court-parchment placeholder:text-court-mist focus:border-court-goldLight focus:outline-none focus:ring-2 focus:ring-court-goldLight"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-lg text-court-mist">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, PLAYER_NAME_MAX))}
            maxLength={PLAYER_NAME_MAX}
            autoComplete="nickname"
            className="min-h-16 w-full min-w-0 rounded-button border border-court-gold/40 bg-court-dusk px-4 text-2xl text-court-parchment focus:border-court-goldLight focus:outline-none focus:ring-2 focus:ring-court-goldLight"
          />
        </label>
        <button
          type="submit"
          disabled={!canJoin}
          className="min-h-16 w-full rounded-button bg-gradient-to-b from-court-goldLight to-court-gold px-6 text-2xl font-semibold text-court-ink shadow-glow disabled:opacity-50"
        >
          {busy ? 'Joining…' : 'Join'}
        </button>
      </form>
      {error && <p className="text-center text-lg text-red-400">{error}</p>}
      {!connected && <p className="text-center text-court-mist">Connecting to server…</p>}
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
  act: (action: unknown) => Promise<void>;
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
        {playAgain && <BigButton onClick={playAgain}>Play again</BigButton>}
        {reset && <BigButton onClick={reset}>Back to lobby</BigButton>}
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
  return (
    <>
      <Header view={view} />
      <h1 className="text-center font-display text-4xl text-court-goldLight">You're in!</h1>
      <p className="text-center text-xl text-court-mist">
        {room.players.length} player{room.players.length === 1 ? '' : 's'} joined
        {missing > 0 && ` · need ${missing} more`}
      </p>
      {view.canStart ? (
        <BigButton onClick={() => send('game:start')}>Start game</BigButton>
      ) : (
        <p className="text-center text-xl text-court-mist">
          {you.isVip ? 'Waiting for more players…' : 'Waiting for the VIP to start…'}
        </p>
      )}
      <button
        type="button"
        onClick={() => send('room:leave')}
        className="min-h-12 text-center text-lg text-court-mist underline"
      >
        Leave room
      </button>
    </>
  );
}

function Header({ view }: { view: PlayerViewMessage }) {
  return (
    <p className="text-center text-lg text-court-mist">
      {view.you.isVip && '👑 '}
      {view.you.name} · {view.room.code}
    </p>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <LatticeBackground className="opacity-[0.07]" />
      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-safe pb-safe pt-safe text-court-parchment">
        {children}
      </main>
    </div>
  );
}

/** Pinned to the top, inside the notch, while the socket is down. */
function Banner({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="fixed inset-x-0 top-0 z-[60] bg-court-danger px-4 pb-1.5 pt-[max(env(safe-area-inset-top),0.375rem)] text-center text-sm font-semibold text-white shadow-lift"
    >
      {children}
    </p>
  );
}

function Toast({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="pointer-events-none fixed inset-x-4 top-[calc(max(env(safe-area-inset-top),0.75rem)+4rem)] z-[60] mx-auto max-w-md rounded-button bg-court-danger px-4 py-3 text-center text-lg text-white shadow-lift"
    >
      {children}
    </p>
  );
}

function BigButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-16 w-full rounded-button bg-gradient-to-b from-court-goldLight to-court-gold px-6 text-2xl font-semibold text-court-ink shadow-glow"
    >
      {children}
    </button>
  );
}
