import type { Rng, RoomPhase } from '@partybox/shared';

/** A player disconnected this long gets flagged so the host can decide to wait or end. */
export const AWAY_LONG_MS = 2 * 60 * 1000;

export interface Seat {
  id: string;
  name: string;
  /** Secret that lets a phone reclaim this seat. Never broadcast. */
  token: string;
  isBot: boolean;
  connected: boolean;
  /** When the last phone for this seat dropped; null while connected. */
  disconnectedAt: number | null;
}

export interface Room {
  code: string;
  /** Secret that lets a TV reclaim the host screen. Never broadcast. */
  hostToken: string;
  gameId: string;
  phase: RoomPhase;
  /** Join order; the order is the seat order handed to the game. */
  seats: Seat[];
  vipId: string | null;
  game: { state: unknown; rng: Rng } | null;
  /** Seeds every game and shuffles seats for Play again, so a room replays from one seed. */
  rng: Rng;
  /** 0-based tutorial slide while the lobby shows the tutorial, else null. */
  tutorial: number | null;
  /** Tokens of seats that were removed, so a returning phone learns why. Never broadcast. */
  removedTokens: Set<string>;
  /** Hash of the creating client's IP, for the per-IP room cap. Never broadcast. */
  ownerKey: string | null;
}
