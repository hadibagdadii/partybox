/** Consonants only, minus look-alikes (L, S, Z) and Y, which reads as a vowel. */
export const ROOM_CODE_ALPHABET = 'BCDFGHJKMNPQRTVWX';
export const ROOM_CODE_LENGTH = 4;

/**
 * Picks an unused room code. `randInt(n)` returns an integer in [0, n); it is
 * injected so tests are deterministic and the server can use crypto.
 */
export function generateRoomCode(
  randInt: (maxExclusive: number) => number,
  isTaken: (code: string) => boolean,
  maxAttempts = 100,
): string {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_ALPHABET[randInt(ROOM_CODE_ALPHABET.length)];
    }
    if (!isTaken(code)) return code;
  }
  throw new Error(`No free room code after ${maxAttempts} attempts`);
}
