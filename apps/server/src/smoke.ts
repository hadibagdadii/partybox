import type { DiwanHostView, DiwanPlayerView } from '@partybox/diwan';
import { createRng, type HostViewMessage } from '@partybox/shared';
import { io as connect } from 'socket.io-client';
import type { Client } from './test-support.js';

export interface SmokeOptions {
  /** Player names, one client each; the first to join is the VIP. */
  names?: string[];
  /** Seeds which legal action each client picks. */
  seed?: number;
  timeoutMs?: number;
}

export interface SmokeResult {
  code: string;
  winner: string | null;
  actions: number;
  /** Secrets the clients were handed, so tests can check they never reach the logs. */
  secrets: { hostToken: string; playerIds: string[]; playerTokens: string[] };
}

const DEFAULT_NAMES = ['Zubayda', 'Harun', 'Layla', 'Tariq', 'Nusayba'];

/**
 * Plays one full Diwan game against a running server using only what a real
 * TV and phones send: no dev tools, no bots. Each phone picks a seeded-random
 * action from its own `legalActions` whenever its view offers one.
 */
export async function playFullGame(
  url: string,
  { names = DEFAULT_NAMES, seed = 1, timeoutMs = 60_000 }: SmokeOptions = {},
): Promise<SmokeResult> {
  const sockets: Client[] = [];
  const open = async () => {
    const socket: Client = connect(url, { transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  };
  const must = <T extends { ok: boolean }>(result: T, what: string): Extract<T, { ok: true }> => {
    if (!result.ok) throw new Error(`${what} failed: ${JSON.stringify(result)}`);
    return result as Extract<T, { ok: true }>;
  };

  try {
    const tv = await open();
    let last: HostViewMessage | null = null;
    let finish: () => void = () => undefined;
    const over = new Promise<void>((resolve) => (finish = resolve));
    tv.on('host:view', (view) => {
      last = view;
      if (view.room.phase === 'over') finish();
    });
    const { code, hostToken } = must(await tv.emitWithAck('room:create', {}), 'room:create');

    const rng = createRng(seed);
    let actions = 0;
    const joined = [];
    for (const name of names) {
      const phone = await open();
      phone.on('player:view', (view) => {
        if (view.room.phase !== 'playing') return;
        const legal = (view.game as DiwanPlayerView | null)?.legalActions ?? [];
        if (legal.length === 0) return;
        actions++;
        // Stale picks are fine: the server rejects anything no longer legal.
        phone
          .emitWithAck('game:action', { action: legal[rng.int(legal.length)] })
          .catch(() => undefined); // Acks still pending when the game ends and we disconnect.
      });
      joined.push(must(await phone.emitWithAck('room:join', { code, name }), 'room:join'));
    }
    must(await sockets[1]!.emitWithAck('game:start', {}), 'game:start');

    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      over,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Game ${code} did not finish`)), timeoutMs);
      }),
    ]);
    clearTimeout(timer);

    const game = (last as HostViewMessage | null)?.game as DiwanHostView | null;
    return {
      code,
      winner: game?.winner?.team ?? null,
      actions,
      secrets: {
        hostToken,
        playerIds: joined.map((j) => j.playerId),
        playerTokens: joined.map((j) => j.playerToken),
      },
    };
  } finally {
    for (const s of sockets) s.disconnect();
  }
}
