import { describe, expect, it } from 'vitest';
import { joinRoomSchema, playerNameSchema, roomCodeSchema } from './events.js';

describe('roomCodeSchema', () => {
  it('normalizes to upper case', () => {
    expect(roomCodeSchema.parse(' bcdf ')).toBe('BCDF');
  });

  it('rejects bad codes', () => {
    expect(roomCodeSchema.safeParse('BC1F').success).toBe(false);
    expect(roomCodeSchema.safeParse('BCDFG').success).toBe(false);
  });

  it('rejects letters outside the alphabet', () => {
    for (const code of ['ABCD', 'BCDS', 'LBCD', 'ZZZZ', 'BCDY']) {
      expect(roomCodeSchema.safeParse(code).success).toBe(false);
    }
  });
});

describe('playerNameSchema', () => {
  it('trims whitespace', () => {
    expect(playerNameSchema.parse('  Zayd  ')).toBe('Zayd');
  });

  it('allows up to 12 characters', () => {
    expect(playerNameSchema.safeParse('A'.repeat(12)).success).toBe(true);
    expect(playerNameSchema.safeParse('A'.repeat(13)).success).toBe(false);
  });

  it('counts length after trimming', () => {
    expect(playerNameSchema.safeParse(`  ${'A'.repeat(12)}  `).success).toBe(true);
    expect(playerNameSchema.safeParse('   ').success).toBe(false);
  });
});

describe('joinRoomSchema', () => {
  it('requires a name', () => {
    expect(joinRoomSchema.safeParse({ code: 'BCDF', name: '' }).success).toBe(false);
    expect(joinRoomSchema.safeParse({ code: 'BCDF', name: 'Zayd' }).success).toBe(true);
  });
});
