import type { DecreeId, PowerId, RoleId, TeamId, VoteId } from './ids.js';

export type Phase =
  'reveal' | 'nominate' | 'vote' | 'ameerDiscard' | 'wazirEnact' | 'vetoPending' | 'power' | 'over';

export interface DiwanPlayer {
  id: string;
  name: string;
  role: RoleId;
  alive: boolean;
}

export type WinReason = 'loyalDecrees' | 'usurperExiled' | 'rebelDecrees' | 'usurperElected';

export interface Winner {
  team: TeamId;
  reason: WinReason;
}

/** Public record of what happened. Never carries roles, hands, or spy results. */
export type LogEntry =
  | { type: 'nominated'; ameerId: string; wazirId: string }
  | { type: 'votesRevealed'; votes: Record<string, VoteId>; passed: boolean }
  | { type: 'unrest'; level: number }
  | { type: 'riot'; decree: DecreeId }
  | { type: 'enacted'; decree: DecreeId; ameerId: string; wazirId: string }
  | { type: 'reshuffled'; drawCount: number }
  | { type: 'vetoProposed'; wazirId: string }
  | { type: 'vetoAnswered'; ameerId: string; accept: boolean }
  | { type: 'powerUsed'; power: PowerId; ameerId: string; targetId?: string }
  | { type: 'exiled'; targetId: string }
  | { type: 'gameOver'; winner: TeamId; reason: WinReason };

/** Private knowledge shown only to the player who earned it. */
export type Secret =
  | { type: 'investigate'; targetId: string; team: TeamId }
  | { type: 'policyPeek'; cards: DecreeId[] };

export interface DiwanState {
  /** Seat order. */
  players: DiwanPlayer[];
  phase: Phase;
  /** Players who have seen their role. The first round starts once everyone has. */
  acknowledgedIds: string[];
  /** Seat of the Ameer the rotation continues from; a Successor does not move it. */
  rotationSeat: number;
  ameerId: string;
  nomineeId: string | null;
  /** The last elected government, for term limits. Cleared by a Riot. */
  lastElected: { ameerId: string; wazirId: string } | null;
  /** Hidden until every living player has voted. */
  votes: Record<string, VoteId>;
  draw: DecreeId[];
  discard: DecreeId[];
  /** Cards held by the Ameer (3) or Wazir (2) during legislation. */
  hand: DecreeId[];
  enacted: Record<DecreeId, number>;
  unrest: number;
  vetoRefused: boolean;
  pendingPower: PowerId | null;
  spiedIds: string[];
  /** Ameer for the next round only, chosen with Name a Successor. */
  successorId: string | null;
  secrets: Record<string, Secret[]>;
  log: LogEntry[];
  winner: Winner | null;
}
