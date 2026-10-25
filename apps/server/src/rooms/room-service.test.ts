import { createRng, type AckResult } from '@partybox/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_ID, gameRegistry } from '../games.js';
import { MemoryRoomStore } from './room-store.js';
import { RoomService } from './room-service.js';

function setup() {
  let id = 0;
  const rng = createRng(99);
  const rooms = new RoomService({
    store: new MemoryRoomStore(),
    games: gameRegistry,
    defaultGameId: DEFAULT_GAME_ID,
    randInt: rng.int,
    newId: () => `id-${++id}`,
  });
  const created = ok(rooms.createRoom());
  return { rooms, code: created.code, hostToken: created.hostToken };
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
