import { createRng, type AckResult } from '@partybox/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GAME_ID, createGameRegistry } from '../games.js';
import { BOT_MAX_DELAY_MS, BOT_MIN_DELAY_MS, BotRunner } from './bot-runner.js';
import { MemoryRoomStore } from './room-store.js';
import { RoomService } from './room-service.js';

function ok<T extends object>(result: AckResult<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result;
}

function setup(humans = 0, botCount = 7) {
  let id = 0;
  const rooms = new RoomService({
    store: new MemoryRoomStore(),
    games: createGameRegistry({ devTools: true }),
    defaultGameId: DEFAULT_GAME_ID,
    randInt: createRng(5).int,
    newId: () => `id-${++id}`,
  });
  const { code } = ok(rooms.createRoom());
  const humanIds = Array.from({ length: humans }, (_, i) => ok(rooms.join(code, `H${i}`)).playerId);
  for (let i = 0; i < botCount; i++) ok(rooms.addBot(code));
  const changes: string[] = [];
  const bots: BotRunner = new BotRunner({
    rooms,
    rng: createRng(11),
    onChange: (c) => {
      changes.push(c);
      bots.sync(c);
    },
  });
  return { rooms, code, bots, changes, humanIds };
}

const phaseOf = (rooms: RoomService, code: string) =>
  (rooms.hostView(code)?.game as { phase: string } | null)?.phase;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BotRunner', () => {
  it('waits 500-1200 ms, then acknowledges roles for every bot', () => {
    const { rooms, code, bots, changes } = setup();
    ok(rooms.devStart(code));
    bots.sync(code);
    expect(bots.pendingBots(code)).toHaveLength(7);

    vi.advanceTimersByTime(BOT_MIN_DELAY_MS - 1);
    expect(changes).toHaveLength(0);
    vi.advanceTimersByTime(BOT_MAX_DELAY_MS - BOT_MIN_DELAY_MS + 1);
    expect(changes.length).toBeGreaterThanOrEqual(7);
    expect(phaseOf(rooms, code)).not.toBe('reveal');
  });

  it('plays an all-bot game to the end and then leaves no timers', () => {
    const { rooms, code, bots } = setup();
    ok(rooms.devStart(code));
    bots.sync(code);
    for (let i = 0; i < 2000 && rooms.hostView(code)?.room.phase !== 'over'; i++) {
      vi.advanceTimersByTime(BOT_MAX_DELAY_MS);
    }
    expect(rooms.hostView(code)?.room.phase).toBe('over');
    expect(bots.pendingBots(code)).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never acts for a human', () => {
    const { rooms, code, bots, humanIds } = setup(1, 6);
    ok(rooms.start(code, humanIds[0]!));
    bots.sync(code);
    expect(bots.pendingBots(code)).not.toContain(humanIds[0]);
    vi.advanceTimersByTime(BOT_MAX_DELAY_MS * 10);
    expect(phaseOf(rooms, code)).toBe('reveal');
    expect(rooms.hostView(code)?.waitingOn).toEqual(humanIds);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels pending timers for a room', () => {
    const { rooms, code, bots, changes } = setup();
    ok(rooms.devStart(code));
    bots.sync(code);
    bots.cancel(code);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(BOT_MAX_DELAY_MS * 2);
    expect(changes).toEqual([]);
  });
});
