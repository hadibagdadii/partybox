import { createRng, type AckResult } from '@partybox/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_ID, createGameRegistry } from '../games.js';
import { MemoryRoomStore } from './room-store.js';
import { AWAY_LONG_MS, RoomService } from './room-service.js';

/** Most room rules are easiest to exercise with Tap Race's 2-player games. */
function setup(gameId = 'tap-race', devTools = true, seed = 99) {
  let id = 0;
  const clock = { now: 0 };
  const rng = createRng(seed);
  const rooms = new RoomService({
    store: new MemoryRoomStore(),
    games: createGameRegistry({ devTools }),
    defaultGameId: DEFAULT_GAME_ID,
    randInt: rng.int,
    newId: () => `id-${++id}`,
    now: () => clock.now,
  });
  const created = ok(rooms.createRoom(gameId));
  return { rooms, code: created.code, hostToken: created.hostToken, clock };
}

/** A Diwan lobby with a VIP, a second human, and bots to reach `size` seats. */
function diwanLobby(size = 5, seed = 99) {
  const base = setup('diwan', true, seed);
  const vip = ok(base.rooms.join(base.code, 'Amina'));
  const other = ok(base.rooms.join(base.code, 'Bilal'));
  for (let i = 2; i < size; i++) ok(base.rooms.addBot(base.code));
  return { ...base, vip, other };
}

function ok<T extends object>(result: AckResult<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result;
}

function errorCode(result: AckResult) {
  return result.ok ? null : result.error.code;
}

describe('RoomService join', () => {
  it('rejects unknown rooms', () => {
    const { rooms } = setup();
    expect(errorCode(rooms.join('BBBB', 'Amina'))).toBe('room_not_found');
  });

  it('makes the first human the VIP', () => {
    const { rooms, code } = setup();
    ok(rooms.addBot(code));
    const amina = ok(rooms.join(code, 'Amina'));
    const bilal = ok(rooms.join(code, 'Bilal'));
    expect(rooms.playerView(code, amina.playerId)?.you.isVip).toBe(true);
    expect(rooms.playerView(code, bilal.playerId)?.you.isVip).toBe(false);
  });

  it('rejects duplicate names regardless of case', () => {
    const { rooms, code } = setup();
    ok(rooms.join(code, 'Zayd'));
    expect(errorCode(rooms.join(code, 'Zayd'))).toBe('name_taken');
    expect(errorCode(rooms.join(code, 'zAYD'))).toBe('name_taken');
  });

  it('rejects a name that collides with a bot', () => {
    const { rooms, code } = setup();
    ok(rooms.addBot(code));
    expect(errorCode(rooms.join(code, 'bot 1'))).toBe('name_taken');
  });

  it('rejects joins once the room is full', () => {
    const { rooms, code } = setup();
    for (let i = 0; i < 10; i++) ok(rooms.join(code, `P${i}`));
    expect(errorCode(rooms.join(code, 'Late'))).toBe('room_full');
    expect(errorCode(rooms.addBot(code))).toBe('room_full');
  });

  it('rejects new players once the game has started', () => {
    const { rooms, code } = setup();
    const vip = ok(rooms.join(code, 'Amina'));
    ok(rooms.join(code, 'Bilal'));
    ok(rooms.start(code, vip.playerId));
    expect(errorCode(rooms.join(code, 'Late'))).toBe('game_in_progress');
  });
});

describe('RoomService start', () => {
  it('only lets the VIP start, once enough players have joined', () => {
    const { rooms, code } = setup();
    const vip = ok(rooms.join(code, 'Amina'));
    expect(rooms.playerView(code, vip.playerId)?.canStart).toBe(false);
    expect(errorCode(rooms.start(code, vip.playerId))).toBe('not_enough_players');

    const other = ok(rooms.join(code, 'Bilal'));
    expect(rooms.playerView(code, vip.playerId)?.canStart).toBe(true);
    expect(rooms.playerView(code, other.playerId)?.canStart).toBe(false);
    expect(errorCode(rooms.start(code, other.playerId))).toBe('not_vip');

    ok(rooms.start(code, vip.playerId));
    expect(rooms.hostView(code)?.room.phase).toBe('playing');
    expect(errorCode(rooms.start(code, vip.playerId))).toBe('wrong_phase');
  });
});

describe('RoomService actions', () => {
  it('routes actions to the game and ends the room when it is over', () => {
    const { rooms, code } = setup();
    const vip = ok(rooms.join(code, 'Amina'));
    const other = ok(rooms.join(code, 'Bilal'));
    expect(errorCode(rooms.act(code, other.playerId, { type: 'tap' }))).toBe('wrong_phase');

    ok(rooms.start(code, vip.playerId));
    expect(errorCode(rooms.act(code, other.playerId, { type: 'cheat' }))).toBe('invalid_action');
    expect(errorCode(rooms.act(code, 'stranger', { type: 'tap' }))).toBe('not_in_room');

    ok(rooms.act(code, other.playerId, { type: 'tap' }));
    expect(rooms.hostView(code)).toMatchObject({
      room: { phase: 'over' },
      game: { winnerId: other.playerId },
    });
    expect(errorCode(rooms.act(code, vip.playerId, { type: 'tap' }))).toBe('wrong_phase');

    expect(errorCode(rooms.reset(code, other.playerId))).toBe('not_vip');
    ok(rooms.reset(code, vip.playerId));
    expect(rooms.hostView(code)).toMatchObject({ room: { phase: 'lobby' }, game: null });
  });
});

describe('RoomService reconnect', () => {
  it('restores the same seat, VIP status, and game state', () => {
    const { rooms, code } = setup();
    const vip = ok(rooms.join(code, 'Amina'));
    const other = ok(rooms.join(code, 'Bilal'));
    ok(rooms.start(code, vip.playerId));
    ok(rooms.act(code, vip.playerId, { type: 'tap' }));

    rooms.setConnected(code, vip.playerId, false);
    expect(rooms.hostView(code)?.room.players[0]).toMatchObject({ connected: false });

    const resumed = ok(rooms.resumePlayer(code, vip.playerToken));
    expect(resumed.playerId).toBe(vip.playerId);
    const view = rooms.playerView(code, resumed.playerId);
    expect(view?.you).toEqual({ id: vip.playerId, name: 'Amina', isVip: true });
    expect(view?.game).toMatchObject({ youWon: true });
    expect(view?.room.players.map((p) => p.id)).toEqual([vip.playerId, other.playerId]);
    expect(view?.room.players[0]?.connected).toBe(true);
  });

  it('rejects unknown tokens', () => {
    const { rooms, code } = setup();
    ok(rooms.join(code, 'Amina'));
    expect(errorCode(rooms.resumePlayer(code, 'not-a-token'))).toBe('invalid_token');
  });

  it('restores the host with the host token only', () => {
    const { rooms, code, hostToken } = setup();
    ok(rooms.resumeHost(code, hostToken));
    expect(errorCode(rooms.resumeHost(code, 'wrong'))).toBe('invalid_token');
  });
});

describe('RoomService views', () => {
  it('never puts tokens in any view', () => {
    const { rooms, code, hostToken } = setup();
    const vip = ok(rooms.join(code, 'Amina'));
    ok(rooms.addBot(code));
    ok(rooms.start(code, vip.playerId));
    const json = JSON.stringify([rooms.hostView(code), rooms.playerView(code, vip.playerId)]);
    expect(json).not.toContain(vip.playerToken);
    expect(json).not.toContain(hostToken);
  });
});

describe('RoomService games', () => {
  it('defaults to Diwan and offers Tap Race only with dev tools', () => {
    const { rooms } = setup(DEFAULT_GAME_ID, false);
    const { code } = ok(rooms.createRoom());
    expect(rooms.hostView(code)?.room.gameId).toBe('diwan');
    expect(rooms.availableGames().map((g) => g.id)).toEqual(['diwan']);
    expect(errorCode(rooms.createRoom('tap-race'))).toBe('unknown_game');
    expect(
      setup('tap-race', true)
        .rooms.availableGames()
        .map((g) => g.id),
    ).toEqual(['diwan', 'tap-race']);
  });

  it('switches games in the lobby only', () => {
    const { rooms, code } = setup('diwan');
    ok(rooms.setGame(code, 'tap-race'));
    expect(rooms.hostView(code)?.room).toMatchObject({ gameId: 'tap-race', minPlayers: 2 });
    expect(errorCode(rooms.setGame(code, 'chess'))).toBe('unknown_game');
    const vip = ok(rooms.join(code, 'Amina'));
    ok(rooms.join(code, 'Bilal'));
    ok(rooms.start(code, vip.playerId));
    expect(errorCode(rooms.setGame(code, 'diwan'))).toBe('game_in_progress');
  });

  it('lets the host start a room of bots in dev', () => {
    const { rooms, code } = setup('diwan');
    for (let i = 0; i < 5; i++) ok(rooms.addBot(code));
    ok(rooms.devStart(code));
    expect(rooms.hostView(code)?.room.phase).toBe('playing');
  });
});

describe('RoomService bot turns', () => {
  it('lists only bots the game waits on, never humans', () => {
    const { rooms, code } = setup('diwan');
    const vip = ok(rooms.join(code, 'Amina'));
    const botIds = Array.from({ length: 4 }, () => ok(rooms.addBot(code)).playerId);
    expect(rooms.botTurns(code)).toEqual([]);
    ok(rooms.start(code, vip.playerId));

    const turns = rooms.botTurns(code);
    expect(turns.map((t) => t.botId)).toEqual(botIds);
    for (const t of turns) expect(t.actions).toEqual([{ type: 'acknowledge' }]);
    expect(rooms.hostView(code)?.waitingOn).toEqual([vip.playerId, ...botIds]);

    for (const id of botIds) ok(rooms.act(code, id, { type: 'acknowledge' }));
    expect(rooms.botTurns(code)).toEqual([]);
    expect(rooms.hostView(code)?.waitingOn).toEqual([vip.playerId]);
  });

  it('has nothing for games without legal actions', () => {
    const { rooms, code } = setup('tap-race');
    const vip = ok(rooms.join(code, 'Amina'));
    ok(rooms.addBot(code));
    ok(rooms.start(code, vip.playerId));
    expect(rooms.botTurns(code)).toEqual([]);
    expect(rooms.hostView(code)?.waitingOn).toHaveLength(2);
  });
});

describe('RoomService tutorial', () => {
  it('lets only the VIP run it, and resumes on the same slide', () => {
    const { rooms, code, vip, other } = diwanLobby();
    expect(errorCode(rooms.startTutorial(code, other.playerId))).toBe('not_vip');
    expect(errorCode(rooms.stepTutorial(code, vip.playerId, 'next'))).toBe('wrong_phase');
    ok(rooms.startTutorial(code, vip.playerId));
    expect(rooms.hostView(code)?.room.tutorial).toEqual({ slide: 0, total: 7 });

    ok(rooms.stepTutorial(code, vip.playerId, 'back'));
    expect(rooms.hostView(code)?.room.tutorial?.slide).toBe(0);
    ok(rooms.stepTutorial(code, vip.playerId, 'next'));
    ok(rooms.stepTutorial(code, vip.playerId, 'next'));
    expect(errorCode(rooms.stepTutorial(code, other.playerId, 'next'))).toBe('not_vip');
    expect(errorCode(rooms.skipTutorial(code, other.playerId))).toBe('not_vip');

    // A refresh asks for fresh views; the slide lives in the room, so both match.
    expect(rooms.hostView(code)?.room.tutorial?.slide).toBe(2);
    expect(rooms.playerView(code, vip.playerId)?.room.tutorial?.slide).toBe(2);
    ok(rooms.stepTutorial(code, vip.playerId, 'back'));
    expect(rooms.playerView(code, other.playerId)?.room.tutorial?.slide).toBe(1);
  });

  it('starts the game on Next from the last slide', () => {
    const { rooms, code, vip } = diwanLobby();
    ok(rooms.startTutorial(code, vip.playerId));
    for (let i = 0; i < 6; i++) ok(rooms.stepTutorial(code, vip.playerId, 'next'));
    expect(rooms.hostView(code)?.room).toMatchObject({ phase: 'lobby', tutorial: { slide: 6 } });
    ok(rooms.stepTutorial(code, vip.playerId, 'next'));
    expect(rooms.hostView(code)?.room).toMatchObject({ phase: 'playing', tutorial: null });
    expect(errorCode(rooms.startTutorial(code, vip.playerId))).toBe('wrong_phase');
  });

  it('starts the game on Skip', () => {
    const { rooms, code, vip } = diwanLobby();
    expect(errorCode(rooms.skipTutorial(code, vip.playerId))).toBe('wrong_phase');
    ok(rooms.startTutorial(code, vip.playerId));
    ok(rooms.skipTutorial(code, vip.playerId));
    expect(rooms.hostView(code)?.room).toMatchObject({ phase: 'playing', tutorial: null });
  });

  it('is unavailable for games without one', () => {
    const { rooms, code } = setup('tap-race');
    const vip = ok(rooms.join(code, 'Amina'));
    expect(errorCode(rooms.startTutorial(code, vip.playerId))).toBe('no_tutorial');
  });
});

describe('RoomService play again', () => {
  function finishedTapRace(seed = 99) {
    const base = setup('tap-race', true, seed);
    const vip = ok(base.rooms.join(base.code, 'Amina'));
    const others = ['Bilal', 'Dalia', 'Faris', 'Huda', 'Jamal'].map(
      (n) => ok(base.rooms.join(base.code, n)).playerId,
    );
    ok(base.rooms.start(base.code, vip.playerId));
    ok(base.rooms.act(base.code, vip.playerId, { type: 'tap' }));
    return { ...base, vip, ids: [vip.playerId, ...others] };
  }

  it('keeps the same players and reshuffles seats with the room RNG', () => {
    const { rooms, code, vip, ids } = finishedTapRace();
    expect(errorCode(rooms.playAgain(code, ids[1]!))).toBe('not_vip');
    ok(rooms.playAgain(code, vip.playerId));
    const room = rooms.hostView(code)!.room;
    expect(room.phase).toBe('playing');
    const order = room.players.map((p) => p.id);
    expect([...order].sort()).toEqual([...ids].sort());
    expect(order).not.toEqual(ids);
    expect(rooms.playerView(code, vip.playerId)?.you.isVip).toBe(true);

    // Same seed, same shuffle: replayable.
    const again = finishedTapRace();
    ok(again.rooms.playAgain(again.code, again.vip.playerId));
    expect(again.rooms.hostView(again.code)!.room.players.map((p) => p.id)).toEqual(order);
  });

  it('only works once the game is over', () => {
    const { rooms, code, vip } = diwanLobby();
    expect(errorCode(rooms.playAgain(code, vip.playerId))).toBe('wrong_phase');
    ok(rooms.start(code, vip.playerId));
    expect(errorCode(rooms.playAgain(code, vip.playerId))).toBe('wrong_phase');
  });
});

describe('RoomService removal', () => {
  it('lets the host remove a lobby player and hands VIP to the next human', () => {
    const { rooms, code, vip, other } = diwanLobby();
    ok(rooms.kick(code, vip.playerId));
    const room = rooms.hostView(code)!.room;
    expect(room.players.map((p) => p.id)).not.toContain(vip.playerId);
    expect(room.players.find((p) => p.isVip)?.id).toBe(other.playerId);
    expect(rooms.playerView(code, vip.playerId)).toBeNull();
    expect(errorCode(rooms.resumePlayer(code, vip.playerToken))).toBe('removed');
    expect(errorCode(rooms.kick(code, vip.playerId))).toBe('not_in_room');
  });

  it('leaves no VIP when only bots remain', () => {
    const { rooms, code, vip, other } = diwanLobby();
    ok(rooms.leave(code, other.playerId));
    ok(rooms.leave(code, vip.playerId));
    expect(rooms.hostView(code)!.room.players.some((p) => p.isVip)).toBe(false);
    const late = ok(rooms.join(code, 'Late'));
    expect(rooms.playerView(code, late.playerId)?.you.isVip).toBe(true);
  });

  it('passes VIP on when the VIP leaves', () => {
    const { rooms, code, vip, other } = diwanLobby();
    ok(rooms.leave(code, vip.playerId));
    expect(rooms.playerView(code, other.playerId)?.you.isVip).toBe(true);
  });

  it('refuses removal or leaving mid-game', () => {
    const { rooms, code, vip, other } = diwanLobby();
    ok(rooms.start(code, vip.playerId));
    expect(errorCode(rooms.kick(code, other.playerId))).toBe('cannot_remove');
    expect(errorCode(rooms.leave(code, other.playerId))).toBe('game_in_progress');
    expect(rooms.hostView(code)!.room.players).toHaveLength(5);
  });
});

describe('RoomService end game', () => {
  it('returns everyone to the lobby without revealing roles', () => {
    const { rooms, code, vip, other } = diwanLobby(7);
    expect(errorCode(rooms.endGame(code))).toBe('wrong_phase');
    ok(rooms.start(code, vip.playerId));
    ok(rooms.endGame(code));
    const host = rooms.hostView(code)!;
    const phones = [vip, other].map((p) => rooms.playerView(code, p.playerId)!);
    expect(host).toMatchObject({ room: { phase: 'lobby', tutorial: null }, game: null });
    for (const v of phones) expect(v.game).toBeNull();
    const json = JSON.stringify([host, ...phones]);
    expect(json).not.toMatch(/roles|usurper|"role"/);
    expect(host.room.players).toHaveLength(7);
    ok(rooms.start(code, vip.playerId));
  });
});

describe('RoomService away flag', () => {
  it('flags a player gone for two minutes, and clears it on return', () => {
    const { rooms, code, vip, clock } = diwanLobby();
    ok(rooms.start(code, vip.playerId));
    clock.now = 1_000;
    rooms.setConnected(code, vip.playerId, false);
    const player = () => rooms.hostView(code)!.room.players.find((p) => p.id === vip.playerId)!;
    clock.now = 1_000 + AWAY_LONG_MS - 1;
    expect(player()).toMatchObject({ connected: false, awayLong: false });
    clock.now = 1_000 + AWAY_LONG_MS;
    expect(player().awayLong).toBe(true);
    ok(rooms.resumePlayer(code, vip.playerToken));
    expect(player()).toMatchObject({ connected: true, awayLong: false });
  });
});
