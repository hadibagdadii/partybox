import { describe, expect, it } from 'vitest';
import { createRng } from './rng.js';
import { generateRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './room-code.js';

describe('ROOM_CODE_ALPHABET', () => {
  it('has no vowels or confusing letters', () => {
    for (const letter of 'AEIOUYLSZ') expect(ROOM_CODE_ALPHABET).not.toContain(letter);
  });

  it('has no duplicate letters', () => {
    expect(new Set(ROOM_CODE_ALPHABET).size).toBe(ROOM_CODE_ALPHABET.length);
  });
});

describe('generateRoomCode', () => {
  it('produces 4 letters from the alphabet', () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode(rng.int, () => false);
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      for (const letter of code) expect(ROOM_CODE_ALPHABET).toContain(letter);
    }
  });

  it('skips codes already in use', () => {
    const rng = createRng(2);
    const first = generateRoomCode(createRng(2).int, () => false);
    const taken = new Set([first]);
    const second = generateRoomCode(rng.int, (code) => taken.has(code));
    expect(second).not.toBe(first);
  });

  it('gives up when every code is taken', () => {
    expect(() => generateRoomCode(createRng(3).int, () => true, 10)).toThrow(/No free room code/);
  });
});
