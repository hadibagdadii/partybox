import type { DiwanHostView, DiwanPlayerView } from '@partybox/diwan';
import { afterEach, describe, expect, it } from 'vitest';
import { ok, record, startTestServer, until, type TestServer } from './test-support.js';

let server: TestServer | undefined;

async function start(bots = { minDelayMs: 0, maxDelayMs: 0, seed: 7 }) {
  server = await startTestServer({ devTools: true, bots });
  return server;
}

afterEach(async () => {
  await server?.close();
  server = undefined;
});

const FORBIDDEN_HOST_KEYS = new Set(['role', 'hand', 'draw', 'discard', 'secrets', 'peek']);

function forbiddenKeys(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => forbiddenKeys(v, `${path}[${i}]`));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => [
    ...(FORBIDDEN_HOST_KEYS.has(k) ? [`${path}.${k}`] : []),
    ...forbiddenKeys(v, `${path}.${k}`),
  ]);
}

describe('Diwan over real sockets', () => {
  it('plays a 7-bot game to a winner without ever showing the host a role early', async () => {
    const s = await start();
    const tv = await s.client();
    const tvLog = record(tv);
    const { code } = await ok(tv.emitWithAck('room:create', {}));
    for (let i = 0; i < 7; i++) await ok(tv.emitWithAck('dev:addBot', {}));
    await ok(tv.emitWithAck('dev:start', {}));

    await until(() => tvLog.host.some((v) => v.room.phase === 'over'), 15_000);
    const views = tvLog.host.filter((v) => v.room.code === code);
    const last = views.at(-1)!;
    const game = last.game as DiwanHostView;
    expect(last.room.gameId).toBe('diwan');
    expect(game.phase).toBe('over');
    expect(game.winner).not.toBeNull();
    expect(Object.keys(game.roles ?? {})).toHaveLength(7);
    expect(last.waitingOn).toEqual([]);

    const playing = views.filter((v) => v.room.phase !== 'over' && v.game);
    // Reveal, then many rounds: the bots really played rather than the game ending early.
    expect(playing.length).toBeGreaterThan(20);
    expect((playing[0]!.game as DiwanHostView).phase).toBe('reveal');
    for (const v of playing) {
      expect((v.game as DiwanHostView).roles).toBeNull();
      expect(forbiddenKeys(v)).toEqual([]);
      expect(JSON.stringify(v)).not.toMatch(/usurper|knownRoles/);
    }
  }, 20_000);

  it('plays again with the same players in a reshuffled order', async () => {
    const s = await start();
    const tv = await s.client();
    const tvLog = record(tv);
    const { code } = await ok(tv.emitWithAck('room:create', {}));
    const vip = await s.client();
    await ok(vip.emitWithAck('room:join', { code, name: 'Amina' }));
    for (let i = 0; i < 6; i++) await ok(tv.emitWithAck('dev:addBot', {}));
    await ok(vip.emitWithAck('game:start', {}));
    await until(() => tvLog.host.at(-1)?.room.phase === 'playing');
    const order = tvLog.host.at(-1)!.room.players.map((p) => p.id);

    // Diwan only ends by play; ending early and replaying must not count as "over".
    expect(await vip.emitWithAck('game:playAgain', {})).toMatchObject({
      ok: false,
      error: { code: 'wrong_phase' },
    });
    // The VIP plays like a bot: the first legal action whenever the game waits on them.
    // Repeats are harmless: the server rejects anything no longer legal.
    vip.on('player:view', (v) => {
      const action = (v.game as DiwanPlayerView | null)?.legalActions[0];
      if (action && v.room.phase === 'playing') void vip.emitWithAck('game:action', { action });
    });
    await ok(vip.emitWithAck('game:action', { action: { type: 'acknowledge' } }));
    await until(() => tvLog.host.at(-1)?.room.phase === 'over', 15_000);
    vip.off('player:view');

    await ok(vip.emitWithAck('game:playAgain', {}));
    await until(() => (tvLog.host.at(-1)?.game as DiwanHostView | null)?.phase === 'reveal');
    const next = tvLog.host.at(-1)!;
    const ids = next.room.players.map((p) => p.id);
    expect([...ids].sort()).toEqual([...order].sort());
    expect(ids).not.toEqual(order);
    expect((next.game as DiwanHostView).players.map((p) => p.id)).toEqual(ids);
    expect((next.game as DiwanHostView).roles).toBeNull();
  }, 20_000);

  it('waits on a disconnected human and resumes when they come back', async () => {
    const s = await start();
    const tv = await s.client();
    const tvLog = record(tv);
    const { code } = await ok(tv.emitWithAck('room:create', {}));
    const phone = await s.client();
    const amina = await ok(phone.emitWithAck('room:join', { code, name: 'Amina' }));
    for (let i = 0; i < 6; i++) await ok(tv.emitWithAck('dev:addBot', {}));
    await ok(phone.emitWithAck('game:start', {}));

    // Every bot acknowledges its role; only Amina is left.
    const latest = () => tvLog.host.at(-1)!;
    await until(() => latest().waitingOn.length === 1);
    expect(latest().waitingOn).toEqual([amina.playerId]);

    phone.disconnect();
    await until(() => latest().room.players[0]?.connected === false);
    const seen = tvLog.host.length;
    await new Promise((r) => setTimeout(r, 100));
    // Nobody acts for her: nothing changes while she is away.
    expect(tvLog.host).toHaveLength(seen);
    expect((latest().game as DiwanHostView).phase).toBe('reveal');
    expect(latest().waitingOn).toEqual([amina.playerId]);

    const again = await s.client();
    const againLog = record(again);
    await ok(again.emitWithAck('player:resume', { code, playerToken: amina.playerToken }));
    await until(() => againLog.player.length > 0);
    const mine = againLog.player.at(-1)!.game as DiwanPlayerView;
    expect(mine.legalActions).toEqual([{ type: 'acknowledge' }]);
    await ok(again.emitWithAck('game:action', { action: { type: 'acknowledge' } }));

    await until(() => (latest().game as DiwanHostView).phase !== 'reveal');
    expect(latest().room.players[0]?.connected).toBe(true);
  });

  it('lets only the host pick the game, and keeps dev tools off in production', async () => {
    const s = await start();
    const tv = await s.client();
    const tvLog = record(tv);
    const { code } = await ok(tv.emitWithAck('room:create', {}));
    await until(() => tvLog.host.length > 0);
    expect(tvLog.host.at(-1)?.games.map((g) => g.id)).toEqual(['diwan', 'tap-race']);

    const phone = await s.client();
    await ok(phone.emitWithAck('room:join', { code, name: 'Amina' }));
    expect(await phone.emitWithAck('room:setGame', { gameId: 'tap-race' })).toMatchObject({
      ok: false,
      error: { code: 'not_in_room' },
    });
    await ok(tv.emitWithAck('room:setGame', { gameId: 'tap-race' }));
    await until(() => tvLog.host.at(-1)?.room.gameId === 'tap-race');
    await s.close();

    const prod = await startTestServer({ devTools: false });
    server = prod;
    const prodTv = await prod.client();
    const prodLog = record(prodTv);
    await ok(prodTv.emitWithAck('room:create', {}));
    await until(() => prodLog.host.length > 0);
    expect(prodLog.host.at(-1)?.games.map((g) => g.id)).toEqual(['diwan']);
    expect(await prodTv.emitWithAck('dev:start', {})).toMatchObject({
      ok: false,
      error: { code: 'dev_only' },
    });
  });
});
