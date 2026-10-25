import { describe, expect, it } from 'vitest';
import type { Room } from './room.js';
import { MemoryRoomStore } from './room-store.js';

const room = (code: string): Room => ({
  code,
  hostToken: 'token',
  gameId: 'tap-race',
  phase: 'lobby',
  seats: [],
  vipId: null,
  game: null,
});

describe('MemoryRoomStore', () => {
  it('expires rooms idle past the TTL', () => {
    let now = 0;
    const store = new MemoryRoomStore(1000, () => now);
    store.save(room('BCDF'));
    store.save(room('GHJK'));

    now = 600;
    store.save(store.get('GHJK')!); // activity resets the clock

    now = 1500;
    expect(store.sweepIdle()).toEqual(['BCDF']);
    expect(store.has('BCDF')).toBe(false);
    expect(store.has('GHJK')).toBe(true);
  });
});
