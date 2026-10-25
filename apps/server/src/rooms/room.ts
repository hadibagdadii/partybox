import type { Rng, RoomPhase } from '@partybox/shared';

export interface Seat {
  id: string;
  name: string;
  /** Secret that lets a phone reclaim this seat. Never broadcast. */
  token: string;
  isBot: boolean;
  connected: boolean;
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
}
