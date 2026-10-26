import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@partybox/shared';

const notInAlphabet = new RegExp(`[^${ROOM_CODE_ALPHABET}]`, 'g');

/** Uppercases and drops anything that can't be in a room code. */
export const cleanCode = (raw: string) =>
  raw.toUpperCase().replace(notInAlphabet, '').slice(0, ROOM_CODE_LENGTH);

export const isFullCode = (code: string) => code.length === ROOM_CODE_LENGTH;

export const joinPath = (code: string) => `/play?code=${code}`;

/** The real join URL on this page's own origin (Render, tunnel, or dev alike). */
export const joinUrl = (code: string) => `${window.location.origin}${joinPath(code)}`;
