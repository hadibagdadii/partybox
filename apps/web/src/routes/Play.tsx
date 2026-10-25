import {
  PLAYER_NAME_MAX,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type PlayerViewMessage,
} from '@partybox/shared';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { gameScreens } from '../games/registry';
import { getSocket, useConnected, useOnConnect } from '../lib/socket';
import { parseSlot, playerToken } from '../lib/storage';

const notInAlphabet = new RegExp(`[^${ROOM_CODE_ALPHABET}]`, 'g');
const cleanCode = (raw: string) =>
  raw.toUpperCase().replace(notInAlphabet, '').slice(0, ROOM_CODE_LENGTH);

interface SeatRef {
  code: string;
  token: string;
}

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

  useEffect(() => {
    socket.on('player:view', setView);
    return () => {
      socket.off('player:view', setView);
    };
  }, [socket]);

  // Reclaim the seat after a refresh, screen lock, or dropped connection.
  const resume = useCallback(() => {
    if (!seat) return;
    socket.emit('player:resume', { code: seat.code, playerToken: seat.token }, (result) => {
      if (result.ok) return;
      playerToken.clear(seat.code, slot);
      setSeat(null);
      setView(null);
      setError(result.error.message);
    });
  }, [socket, seat, slot]);
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

  const send = (event: 'game:start' | 'game:reset') => {
    setError(null);
    socket.emit(event, {}, (result) => {
      if (!result.ok) setError(result.error.message);
    });
  };

  const act = (action: unknown) => {
    socket.emit('game:action', { action }, (result) => {
      if (!result.ok) setError(result.error.message);
    });
  };

  if (seat) {
    return (
      <Screen>
        {!connected && <Banner>Reconnecting…</Banner>}
        {view ? (
          <Seated view={view} act={act} send={send} />
        ) : (
          <p className="text-center text-xl text-slate-400">Rejoining {seat.code}…</p>
        )}
        {error && <p className="text-center text-lg text-red-400">{error}</p>}
      </Screen>
    );
  }

  const canJoin = code.length === ROOM_CODE_LENGTH && name.trim().length > 0 && connected && !busy;
  return (
    <Screen>
      <h1 className="text-center text-4xl font-bold">Join a game</h1>
      <form onSubmit={join} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-lg text-slate-400">Room code</span>
          <input
            value={code}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            placeholder="BCDF"
            className="min-h-16 rounded-2xl bg-slate-800 px-4 text-center text-4xl font-bold uppercase tracking-[0.4em] placeholder:text-slate-600"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-lg text-slate-400">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, PLAYER_NAME_MAX))}
            maxLength={PLAYER_NAME_MAX}
            autoComplete="nickname"
            className="min-h-16 rounded-2xl bg-slate-800 px-4 text-2xl"
          />
        </label>
        <button
          type="submit"
          disabled={!canJoin}
          className="min-h-16 w-full rounded-2xl bg-amber-500 px-6 text-2xl font-semibold text-slate-950 disabled:opacity-50"
        >
          {busy ? 'Joining…' : 'Join'}
        </button>
      </form>
      {error && <p className="text-center text-lg text-red-400">{error}</p>}
      {!connected && <p className="text-center text-slate-500">Connecting to server…</p>}
    </Screen>
  );
}

function Seated({
  view,
  act,
  send,
}: {
  view: PlayerViewMessage;
  act: (action: unknown) => void;
  send: (event: 'game:start' | 'game:reset') => void;
}) {
  const { room, you } = view;
  const GamePlayer = gameScreens[room.gameId]?.Player;
  const header = (
    <p className="text-center text-lg text-slate-400">
      {you.isVip && '👑 '}
      {you.name} · {room.code}
    </p>
  );

  if (room.phase !== 'lobby' && GamePlayer) {
    return (
      <>
        {header}
        <GamePlayer room={room} you={you} game={view.game} act={act} />
        {room.phase === 'over' && you.isVip && (
          <BigButton onClick={() => send('game:reset')}>Back to lobby</BigButton>
        )}
      </>
    );
  }

  const missing = room.minPlayers - room.players.length;
  return (
    <>
      {header}
      <h1 className="text-center text-4xl font-bold">You're in!</h1>
      <p className="text-center text-xl text-slate-400">
        {room.players.length} player{room.players.length === 1 ? '' : 's'} joined
        {missing > 0 && ` · need ${missing} more`}
      </p>
      {view.canStart ? (
        <BigButton onClick={() => send('game:start')}>Start game</BigButton>
      ) : (
        <p className="text-center text-xl text-slate-500">
          {you.isVip ? 'Waiting for more players…' : 'Waiting for the VIP to start…'}
        </p>
      )}
    </>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 bg-slate-950 px-4 py-8 text-slate-100">
      {children}
    </main>
  );
}

function Banner({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-red-900 px-4 py-2 text-center">{children}</p>;
}

function BigButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-16 w-full rounded-2xl bg-amber-500 px-6 text-2xl font-semibold text-slate-950"
    >
      {children}
    </button>
  );
}
