import type { DecreeId, PowerId, RoleId, TeamId, VoteId } from './ids.js';
import { eligibleWazirIds, livingPlayers, powerTargetIds } from './reduce.js';
import { LEGISLATIVE_DRAW, VETO_UNLOCK, powerTrack, teamOf, usurperSeesRebels } from './rules.js';
import type { DiwanState, LogEntry, Phase, Secret, Winner } from './state.js';

export interface DiwanHostView {
  phase: Phase;
  players: { id: string; name: string; alive: boolean }[];
  ameerId: string;
  nomineeId: string | null;
  lastElected: { ameerId: string; wazirId: string } | null;
  /** Filled only while the Ameer is nominating. */
  eligibleWazirIds: string[];
  /** Filled only while the Ameer is choosing a power target. */
  powerTargetIds: string[];
  /** Who has voted so far, never how. */
  votedIds: string[];
  enacted: Record<DecreeId, number>;
  unrest: number;
  drawCount: number;
  discardCount: number;
  vetoUnlocked: boolean;
  vetoRefused: boolean;
  pendingPower: PowerId | null;
  powerTrack: (PowerId | null)[];
  log: LogEntry[];
  winner: Winner | null;
  /** Null until the game is over, then every player's role. */
  roles: Record<string, RoleId> | null;
}

export interface DiwanPlayerView extends DiwanHostView {
  /** Null for ids not seated in this game. */
  you: { id: string; role: RoleId; team: TeamId; alive: boolean } | null;
  /** Your own role plus whoever your role lets you see. */
  knownRoles: Record<string, RoleId>;
  /** Cards you are holding right now, if any. */
  hand: DecreeId[] | null;
  myVote: VoteId | null;
  secrets: Secret[];
  /** The top of the deck while you resolve Read the Scrolls. */
  peek: DecreeId[] | null;
}

export function getHostView(s: DiwanState): DiwanHostView {
  const over = s.phase === 'over';
  return {
    phase: s.phase,
    players: s.players.map((p) => ({ id: p.id, name: p.name, alive: p.alive })),
    ameerId: s.ameerId,
    nomineeId: s.nomineeId,
    lastElected: s.lastElected && { ...s.lastElected },
    eligibleWazirIds: s.phase === 'nominate' ? eligibleWazirIds(s) : [],
    powerTargetIds: powerTargetIds(s),
    votedIds:
      s.phase === 'vote'
        ? livingPlayers(s)
            .filter((p) => p.id in s.votes)
            .map((p) => p.id)
        : [],
    enacted: { ...s.enacted },
    unrest: s.unrest,
    drawCount: s.draw.length,
    discardCount: s.discard.length,
    vetoUnlocked: s.enacted.rebel >= VETO_UNLOCK,
    vetoRefused: s.vetoRefused,
    pendingPower: s.pendingPower,
    powerTrack: [...powerTrack(s.players.length)],
    log: [...s.log],
    winner: s.winner && { ...s.winner },
    roles: over ? Object.fromEntries(s.players.map((p) => [p.id, p.role])) : null,
  };
}

export function getPlayerView(s: DiwanState, playerId: string): DiwanPlayerView {
  const host = getHostView(s);
  const me = s.players.find((p) => p.id === playerId);
  if (!me) {
    return {
      ...host,
      you: null,
      knownRoles: {},
      hand: null,
      myVote: null,
      secrets: [],
      peek: null,
    };
  }

  const holdsHand =
    (s.phase === 'ameerDiscard' && me.id === s.ameerId) ||
    ((s.phase === 'wazirEnact' || s.phase === 'vetoPending') && me.id === s.nomineeId);
  const peeking = s.phase === 'power' && s.pendingPower === 'policyPeek' && me.id === s.ameerId;

  return {
    ...host,
    you: { id: me.id, role: me.role, team: teamOf(me.role), alive: me.alive },
    knownRoles: knownRoles(s, me.id),
    hand: holdsHand ? [...s.hand] : null,
    myVote: s.phase === 'vote' ? (s.votes[me.id] ?? null) : null,
    secrets: (s.secrets[me.id] ?? []).map((x) => ({ ...x })),
    peek: peeking ? s.draw.slice(0, LEGISLATIVE_DRAW) : null,
  };
}

/** Roles a player is allowed to know. */
export function knownRoles(s: DiwanState, playerId: string): Record<string, RoleId> {
  const me = s.players.find((p) => p.id === playerId);
  if (!me) return {};
  if (s.phase === 'over') return Object.fromEntries(s.players.map((p) => [p.id, p.role]));

  const seesRebels =
    me.role === 'rebel' || (me.role === 'usurper' && usurperSeesRebels(s.players.length));
  const known: Record<string, RoleId> = { [me.id]: me.role };
  if (seesRebels) {
    for (const p of s.players) if (p.role !== 'loyal') known[p.id] = p.role;
  }
  return known;
}
