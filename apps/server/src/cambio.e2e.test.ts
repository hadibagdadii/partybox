import {
  CARDS_PER_DECK,
  theme,
  type CambioAction,
  type CambioEvent,
  type CambioHostView,
  type CambioPlayerView,
} from '@partybox/cambio';
import type { AckResult, HostViewMessage } from '@partybox/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { ReflexOutcome } from './rooms/bot-runner.js';
import {
  ok,
  record,
  startTestServer,
  until,
  type Client,
  type TestServer,
} from './test-support.js';

let server: TestServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

async function start(reflexes?: ReflexOutcome[], delays = { minDelayMs: 0, maxDelayMs: 0 }) {
  server = await startTestServer({
    devTools: true,
    bots: { ...delays, seed: 7, onReflex: (r) => reflexes?.push(r) },
  });
  return server;
}

type Snap = Extract<CambioAction, { type: 'snap' }>;
const cambioView = (v: HostViewMessage | undefined) => v?.game as CambioHostView | null;

/** Card ids in hands whose face the host view carries, other than ones a wrong snap showed everyone. */
function faceLeaks(v: CambioHostView): string[] {
  if (v.phase !== 'peek' && v.phase !== 'play') return []; // Round results reveal every hand.
  const shown = new Set(v.log.flatMap((e) => (e.type === 'snapFailed' ? [e.card.cardId] : [])));
  const faced = new Set<string>();
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (x === null || typeof x !== 'object') return;
    const o = x as Record<string, unknown>;
    if ('face' in o && typeof o.cardId === 'string') faced.add(o.cardId);
    Object.values(o).forEach(walk);
  };
  walk(v);
  return v.players.flatMap((p) =>
    p.slots.filter((s) => faced.has(s.cardId) && !shown.has(s.cardId)).map((s) => s.cardId),
  );
}

/** Every card is in exactly one place: a hand, the deck, the discard, or the drawer's hand. */
function checkTable(v: CambioHostView, decks: number) {
  if (v.phase !== 'peek' && v.phase !== 'play') return;
  const ids = v.players.flatMap((p) => p.slots.map((s) => s.cardId));
  expect(new Set(ids).size).toBe(ids.length);
  const held = v.turn?.drawnCardId ? 1 : 0;
  expect(ids.length + v.deckCount + v.discardCount + held).toBe(decks * CARDS_PER_DECK);
}

/** Within a round the log only grows, and every view's log extends the one before. */
function checkLogOrder(views: CambioHostView[]) {
  for (let i = 1; i < views.length; i++) {
    const [a, b] = [views[i - 1]!, views[i]!];
    if (a.round !== b.round) continue;
    expect(b.log.length).toBeGreaterThanOrEqual(a.log.length);
    expect(JSON.stringify(b.log.slice(0, a.log.length))).toBe(JSON.stringify(a.log));
  }
}

/** Snap events and bot rejections seen across every bot game, for the coverage check. */
const coverage = new Set<string>();

function noteSnaps(views: CambioHostView[], reflexes: ReflexOutcome[]) {
  for (const v of views) {
    for (const e of v.log) {
      if (e.type === 'snapped' || e.type === 'snapFailed') {
        coverage.add(`${e.type}:${e.snapperId === e.ownerId ? 'own' : 'other'}`);
      }
    }
  }
  for (const r of reflexes) if (!r.result.ok) coverage.add(`rejected:${r.result.error.message}`);
}

async function botGame(bots: number, scoringMode: 'single' | 'match') {
  const reflexes: ReflexOutcome[] = [];
  const s = await start(reflexes);
  const tv = await s.client();
  const tvLog = record(tv);
  await ok(tv.emitWithAck('room:create', { gameId: 'cambio' }));
  await ok(tv.emitWithAck('room:setOptions', { options: { scoringMode } }));
  for (let i = 0; i < bots; i++) await ok(tv.emitWithAck('dev:addBot', {}));
  await ok(tv.emitWithAck('dev:start', {}));
  await until(() => tvLog.host.at(-1)?.room.phase === 'over', 25_000);

  const views = tvLog.host.flatMap((m) => {
    const g = cambioView(m);
    return g ? [g] : [];
  });
  return { views, reflexes, last: views.at(-1)! };
}

describe('Cambio bot games over real sockets', () => {
  const cases = [
    { bots: 6, decks: 1, mode: 'single' },
    { bots: 6, decks: 1, mode: 'match' },
    { bots: 10, decks: 2, mode: 'single' },
    { bots: 10, decks: 2, mode: 'match' },
  ] as const;

  for (const { bots, decks, mode } of cases) {
    it(`plays a ${bots}-bot ${mode} game to the end without showing the host a hidden card`, async () => {
      const { views, reflexes, last } = await botGame(bots, mode);
      expect(last.phase).toBe('over');
      expect(last.winners?.length).toBeGreaterThan(0);
      expect(last.options.scoringMode).toBe(mode);
      if (mode === 'single') expect(last.round).toBe(1);
      else {
        expect(last.round).toBeGreaterThan(1);
        expect(Math.max(...Object.values(last.totals))).toBeGreaterThanOrEqual(100);
      }
      expect(views.some((v) => v.phase === 'play')).toBe(true);
      for (const v of views) {
        expect(faceLeaks(v)).toEqual([]);
        checkTable(v, decks);
      }
      checkLogOrder(views);
      noteSnaps(views, reflexes);
    }, 30_000);
  }

  afterAll(() => {
    // Every snap path happened somewhere across the four games.
    expect([...coverage].sort()).toEqual(
      expect.arrayContaining([
        'snapped:own',
        'snapped:other',
        'snapFailed:own',
        'snapFailed:other',
        `rejected:${theme.errors.snapTooLate}`,
        `rejected:${theme.errors.giveRequired}`,
        `rejected:${theme.errors.locked}`,
      ]),
    );
  });
});

/** Plays a phone's turn moves as they come up. Snaps are left to the test. */
function autoplay(phone: Client, { continueRounds = false } = {}) {
  const state = { paused: false };
  const pick = (v: CambioPlayerView): CambioAction | undefined => {
    const moves = v.legalActions.filter((a) => a.type !== 'snap');
    const prefer = ['ready', 'draw', 'discard', 'skipPower', 'donePeek'] as const;
    for (const type of prefer) {
      const found = moves.find((a) => a.type === type);
      if (found) return found;
    }
    if (continueRounds) return moves.find((a) => a.type === 'continue');
    return moves.find((a) => a.type !== 'continue' && a.type !== 'callCambio');
  };
  phone.on('player:view', (m) => {
    const v = m.game as CambioPlayerView | null;
    if (state.paused || !v || m.room.phase !== 'playing') return;
    const action = pick(v);
    // Fire and forget; a reply still pending at teardown is dropped, not an error.
    if (action) phone.emitWithAck('game:action', { action }).catch(() => undefined);
  });
  return state;
}

describe('Cambio rooms over real sockets', () => {
  it('applies racing snaps in arrival order and keeps every broadcast consistent', async () => {
    const s = await start(undefined, { minDelayMs: 20, maxDelayMs: 60 });
    const tv = await s.client();
    const tvLog = record(tv);
    const { code } = await ok(tv.emitWithAck('room:create', { gameId: 'cambio' }));
    await ok(tv.emitWithAck('room:setOptions', { options: { rememberPeeks: true } }));
    const a = await s.client();
    const b = await s.client();
    const aLog = record(a);
    const bLog = record(b);
    const amina = await ok(a.emitWithAck('room:join', { code, name: 'Amina' }));
    const bilal = await ok(b.emitWithAck('room:join', { code, name: 'Bilal' }));
    await ok(a.emitWithAck('game:start', {}));
    const playA = autoplay(a);
    const playB = autoplay(b);

    // Wait until Amina remembers a card matching the top discard, with nobody else moving.
    const mine = () => aLog.player.at(-1)?.game as CambioPlayerView;
    let target: CambioPlayerView['known'][number] | undefined;
    const deadline = Date.now() + 15_000;
    while (!target) {
      if (Date.now() > deadline) throw new Error('No matching card came up');
      playA.paused = playB.paused = true;
      await new Promise((r) => setTimeout(r, 40));
      const v = mine();
      target =
        v.phase === 'play' && v.topDiscard && v.turn?.stage === 'start'
          ? v.known.find((k) => k.face.rank === v.topDiscard!.face.rank)
          : undefined;
      if (!target) {
        playA.paused = playB.paused = false;
        for (const [phone, pv] of [
          [a, v],
          [b, bLog.player.at(-1)?.game as CambioPlayerView],
        ] as const) {
          const action = pick0(pv);
          // Fire and forget; a reply still pending at teardown is dropped, not an error.
          if (action) phone.emitWithAck('game:action', { action }).catch(() => undefined);
        }
        await new Promise((r) => setTimeout(r, 40));
      }
    }

    const before = cambioView(tvLog.host.at(-1))!;
    const count = (v: CambioHostView, id: string) => v.players.find((p) => p.id === id)!.slots;
    const give = count(before, bilal.playerId)[0]!.slotId;
    const snapA: Snap = { type: 'snap', slotId: target.slotId, cardId: target.cardId };
    const snapB: Snap = { ...snapA, giveSlotId: give };
    const results2 = (await Promise.all([
      a.emitWithAck('game:action', { action: snapA }),
      b.emitWithAck('game:action', { action: snapB }),
    ])) as AckResult[];
    const ra = results2[0]!;

    // Whichever snap reached the server first wins; the other is too late and costs nothing.
    expect(results2.filter((r) => r.ok)).toHaveLength(1);
    const winner = ra.ok ? amina.playerId : bilal.playerId;
    const loser = ra.ok ? bilal.playerId : amina.playerId;
    expect(results2.find((r) => !r.ok)).toEqual({
      ok: false,
      error: { code: 'invalid_action', message: theme.errors.snapTooLate },
    });
    await until(() => cambioView(tvLog.host.at(-1))!.log.length > before.log.length);
    const after = cambioView(tvLog.host.at(-1))!;
    expect(after.log.slice(before.log.length)).toEqual([
      expect.objectContaining({ type: 'snapped', snapperId: winner, ownerId: amina.playerId }),
    ] as CambioEvent[]);
    // The winner is one card down (Bilal gave his away; Amina snapped hers). No penalty for the loser.
    expect(count(after, winner)).toHaveLength(count(before, winner).length - 1);
    expect(count(after, loser)).toHaveLength(count(before, loser).length);

    // A burst of snaps from both phones at once, without waiting for answers.
    const burst: Promise<AckResult>[] = [];
    for (let i = 0; i < 20; i++) {
      for (const [phone, me] of [
        [a, amina.playerId],
        [b, bilal.playerId],
      ] as const) {
        const v = cambioView(tvLog.host.at(-1))!;
        const owner = v.players[i % v.players.length]!;
        const slot = owner.slots[i % owner.slots.length];
        if (!slot) continue;
        const action: Snap = { type: 'snap', slotId: slot.slotId, cardId: slot.cardId };
        if (owner.id !== me) action.giveSlotId = count(v, me)[0]?.slotId;
        burst.push(phone.emitWithAck('game:action', { action }) as Promise<AckResult>);
      }
    }
    const results = await Promise.all(burst);
    const accepted = results.filter((r) => r.ok).length;
    expect(accepted).toBeGreaterThan(0);
    // One broadcast per accepted action, each from the state as it was then. Acks can reach
    // the phones before the TV's last broadcasts do, so wait for those to land.
    const snapEvents = (v: CambioHostView) =>
      v.log.filter((e) => e.type === 'snapped' || e.type === 'snapFailed').length;
    await until(() => snapEvents(cambioView(tvLog.host.at(-1))!) - snapEvents(after) >= accepted);
    await new Promise((r) => setTimeout(r, 50));
    const views = tvLog.host.flatMap((m) => cambioView(m) ?? []);
    expect(snapEvents(views.at(-1)!) - snapEvents(after)).toBe(accepted);
    for (const v of views) {
      checkTable(v, 1);
      expect(faceLeaks(v)).toEqual([]);
    }
    checkLogOrder(views);
    for (const log of [aLog.player, bLog.player]) {
      checkLogOrder(log.flatMap((m) => (m.game as CambioPlayerView | null) ?? []));
    }
  }, 30_000);

  it('keeps options across a TV refresh and rejects invalid ones', async () => {
    const s = await start();
    const tv = await s.client();
    const tvLog = record(tv);
    const { code, hostToken } = await ok(tv.emitWithAck('room:create', { gameId: 'cambio' }));
    await until(() => tvLog.host.length > 0);
    expect(tvLog.host.at(-1)!.room.options).toEqual({
      scoringMode: 'single',
      matchTarget: 100,
      lockCaller: true,
      rememberPeeks: false,
    });
    await ok(tv.emitWithAck('room:setOptions', { options: { scoringMode: 'match' } }));
    await ok(
      tv.emitWithAck('room:setOptions', { options: { matchTarget: 250, lockCaller: false } }),
    );

    const invalid = { ok: false, error: { code: 'invalid_options' } };
    for (const options of [{ matchTarget: 5 }, { matchTarget: 501 }, { scoringMode: 'bogus' }]) {
      expect(await tv.emitWithAck('room:setOptions', { options })).toMatchObject(invalid);
    }
    expect(await tv.emitWithAck('room:setOptions', { options: 'match' } as never)).toMatchObject({
      ok: false,
      error: { code: 'invalid_payload' },
    });
    const phone = await s.client();
    await ok(phone.emitWithAck('room:join', { code, name: 'Amina' }));
    expect(
      await phone.emitWithAck('room:setOptions', { options: { rememberPeeks: true } }),
    ).toMatchObject({ ok: false, error: { code: 'not_in_room' } });

    tv.disconnect();
    const again = await s.client();
    const againLog = record(again);
    await ok(again.emitWithAck('host:resume', { code, hostToken }));
    await until(() => againLog.host.length > 0);
    const kept = {
      scoringMode: 'match',
      matchTarget: 250,
      lockCaller: false,
      rememberPeeks: false,
    };
    expect(againLog.host.at(-1)!.room.options).toEqual(kept);

    await ok(again.emitWithAck('dev:addBot', {}));
    await ok(phone.emitWithAck('game:start', {}));
    await until(() => cambioView(againLog.host.at(-1)) !== null);
    expect(cambioView(againLog.host.at(-1))!.options).toEqual(kept);
    expect(
      await again.emitWithAck('room:setOptions', { options: { matchTarget: 50 } }),
    ).toMatchObject({ ok: false, error: { code: 'wrong_phase' } });

    await ok(again.emitWithAck('game:end', {}));
    await ok(again.emitWithAck('room:setGame', { gameId: 'diwan' }));
    expect(
      await again.emitWithAck('room:setOptions', { options: { matchTarget: 50 } }),
    ).toMatchObject(invalid);
  });

  it('lets only the VIP start the next round, and Play again starts a fresh match', async () => {
    const s = await start();
    const tv = await s.client();
    const tvLog = record(tv);
    const { code } = await ok(tv.emitWithAck('room:create', { gameId: 'cambio' }));
    await ok(tv.emitWithAck('room:setOptions', { options: { scoringMode: 'match' } }));
    const vip = await s.client();
    const other = await s.client();
    const amina = await ok(vip.emitWithAck('room:join', { code, name: 'Amina' }));
    await ok(other.emitWithAck('room:join', { code, name: 'Bilal' }));
    for (let i = 0; i < 3; i++) await ok(tv.emitWithAck('dev:addBot', {}));
    await ok(vip.emitWithAck('game:start', {}));
    autoplay(vip);
    autoplay(other);

    const latest = () => cambioView(tvLog.host.at(-1))!;
    await until(() => latest()?.phase === 'roundOver', 15_000);
    expect(tvLog.host.at(-1)!.waitingOn).toEqual([amina.playerId]);
    expect(latest().lastRound?.round).toBe(1);
    expect(await other.emitWithAck('game:action', { action: { type: 'continue' } })).toEqual({
      ok: false,
      error: { code: 'not_vip', message: 'Only the VIP can do that' },
    });
    // Bots don't move it on either: the TV keeps showing the results.
    const seen = tvLog.host.length;
    await new Promise((r) => setTimeout(r, 100));
    expect(tvLog.host).toHaveLength(seen);
    expect(latest().phase).toBe('roundOver');

    await ok(vip.emitWithAck('game:action', { action: { type: 'continue' } }));
    await until(() => latest().round === 2);
    expect(latest().lastRound?.round).toBe(1);

    vip.off('player:view');
    autoplay(vip, { continueRounds: true });
    await until(() => tvLog.host.at(-1)!.room.phase === 'over', 20_000);
    expect(latest().phase).toBe('over');
    expect(await other.emitWithAck('game:playAgain', {})).toMatchObject({
      ok: false,
      error: { code: 'not_vip' },
    });

    const mark = tvLog.host.length;
    await ok(vip.emitWithAck('game:playAgain', {}));
    await until(() => tvLog.host.length > mark);
    const fresh = cambioView(tvLog.host[mark])!;
    expect(fresh).toMatchObject({ phase: 'peek', round: 1, lastRound: null, winners: null });
    expect(Object.values(fresh.totals).every((t) => t === 0)).toBe(true);
    expect(fresh.options.scoringMode).toBe('match');
  }, 30_000);
});

describe('ENABLE_CAMBIO', () => {
  it('hides Cambio from production unless it is turned on', async () => {
    const off = await startTestServer({ devTools: false });
    server = off;
    const tv = await off.client();
    const tvLog = record(tv);
    expect(await tv.emitWithAck('room:create', { gameId: 'cambio' })).toMatchObject({
      ok: false,
      error: { code: 'unknown_game' },
    });
    await ok(tv.emitWithAck('room:create', {}));
    await until(() => tvLog.host.length > 0);
    expect(tvLog.host.at(-1)!.games.map((g) => g.id)).toEqual(['diwan']);
    expect(await tv.emitWithAck('room:setGame', { gameId: 'cambio' })).toMatchObject({
      ok: false,
      error: { code: 'unknown_game' },
    });
    await off.close();

    const on = await startTestServer({ devTools: false, enableCambio: true });
    server = on;
    const tv2 = await on.client();
    const log2 = record(tv2);
    await ok(tv2.emitWithAck('room:create', {}));
    await until(() => log2.host.length > 0);
    expect(log2.host.at(-1)!.games).toEqual([
      { id: 'diwan', name: 'Diwan', minPlayers: 5, maxPlayers: 10 },
      { id: 'cambio', name: theme.title, minPlayers: 2, maxPlayers: 12 },
    ]);
    await ok(tv2.emitWithAck('room:setGame', { gameId: 'cambio' }));
    await until(() => log2.host.at(-1)!.room.gameId === 'cambio');
  });
});

/** The first turn move in a phone's view, if any; used to nudge play along between checks. */
function pick0(v: CambioPlayerView | undefined): CambioAction | undefined {
  return v?.legalActions.find((a) => a.type !== 'snap' && a.type !== 'callCambio');
}
