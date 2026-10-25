import { describe, expect, it } from 'vitest';
import { joinRoomSchema, roomCodeSchema } from './events.js';

describe('roomCodeSchema', () => {
  it('normalizes to upper case', () => {
    expect(roomCodeSchema.parse(' abcd ')).toBe('ABCD');
  });

  it('rejects bad codes', () => {
    expect(roomCodeSchema.safeParse('AB1D').success).toBe(false);
    expect(roomCodeSchema.safeParse('ABCDE').success).toBe(false);
  });
});

describe('joinRoomSchema', () => {
  it('requires a name', () => {
    expect(joinRoomSchema.safeParse({ code: 'ABCD', name: '' }).success).toBe(false);
    expect(joinRoomSchema.safeParse({ code: 'ABCD', name: 'Zayd' }).success).toBe(true);
  });
});
