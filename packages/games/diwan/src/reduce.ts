import type { GameError, PlayerAction, ReduceResult, Rng } from '@partybox/shared';
import type { DiwanAction } from './actions.js';
import type { DecreeId, TeamId } from './ids.js';
import {
  LEGISLATIVE_DRAW,
  LOYAL_DECREES_TO_WIN,
  REBEL_DECREES_TO_WIN,
  SMALL_TABLE_ALIVE,
  UNREST_LIMIT,
  USURPER_ELECTION_THRESHOLD,
  VETO_UNLOCK,
  powerTrack,
  teamOf,
} from './rules.js';
import { shuffle } from './setup.js';
import type { DiwanPlayer, DiwanState, LogEntry, WinReason } from './state.js';

type Result = ReduceResult<DiwanState, LogEntry>;

/** The working copy of state for one action, plus the events it emits. */
interface Ctx {
  s: DiwanState;
  events: LogEntry[];
  rng: Rng;
}

const err = (code: GameError['code'], message: string): GameError => ({ code, message });

// ---------------------------------------------------------------------------
// Queries shared with the views
// ---------------------------------------------------------------------------

export function livingPlayers(s: DiwanState): DiwanPlayer[] {
  return s.players.filter((p) => p.alive);
}

/** Players the current Ameer may nominate as Wazir. */
export function eligibleWazirIds(s: DiwanState): string[] {
  const smallTable = livingPlayers(s).length <= SMALL_TABLE_ALIVE;
  return livingPlayers(s)
    .filter(
      (p) =>
        p.id !== s.ameerId &&
        p.id !== s.lastElected?.wazirId &&
        (smallTable || p.id !== s.lastElected?.ameerId),
    )
    .map((p) => p.id);
}

/** Valid targets for the pending executive power. */
export function powerTargetIds(s: DiwanState): string[] {
  if (s.phase !== 'power' || s.pendingPower === null || s.pendingPower === 'policyPeek') return [];
  return livingPlayers(s)
    .filter((p) => p.id !== s.ameerId)
    .filter((p) => s.pendingPower !== 'investigate' || !s.spiedIds.includes(p.id))
    .map((p) => p.id);
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reduce(
  prev: DiwanState,
  { playerId, action }: PlayerAction<DiwanAction>,
  rng: Rng,
): Result {
  if (prev.phase === 'over') return { ok: false, error: err('wrong_phase', 'The game is over') };
  const actor = prev.players.find((p) => p.id === playerId);
  if (!actor) return { ok: false, error: err('not_your_turn', 'You are not in this game') };
  if (!actor.alive) {
    return { ok: false, error: err('not_your_turn', 'Exiled players cannot act') };
  }

  const ctx: Ctx = { s: cloneState(prev), events: [], rng };
  const error = handle(ctx, playerId, action);
  if (error) return { ok: false, error };
  return { ok: true, state: ctx.s, events: ctx.events };
}

function handle(ctx: Ctx, actorId: string, action: DiwanAction): GameError | null {
  const { s } = ctx;
  switch (action.type) {
    case 'nominate': {
      if (s.phase !== 'nominate') return err('wrong_phase', 'Not time to nominate');
      if (actorId !== s.ameerId) return err('not_your_turn', 'Only the Ameer nominates');
      if (!eligibleWazirIds(s).includes(action.targetId)) {
        return err('invalid_action', 'That player cannot be nominated');
      }
      s.nomineeId = action.targetId;
      s.votes = {};
      s.phase = 'vote';
      log(ctx, { type: 'nominated', ameerId: s.ameerId, wazirId: action.targetId });
      return null;
    }

    case 'vote': {
      if (s.phase !== 'vote') return err('wrong_phase', 'Not time to vote');
      // A re-vote before the reveal replaces the earlier one.
      s.votes[actorId] = action.vote;
      const living = livingPlayers(s);
      if (living.some((p) => s.votes[p.id] === undefined)) return null;
      resolveVote(ctx);
      return null;
    }

    case 'ameerDiscard': {
      if (s.phase !== 'ameerDiscard')
        return err('wrong_phase', 'Not time for the Ameer to discard');
      if (actorId !== s.ameerId) return err('not_your_turn', 'Only the Ameer discards now');
      if (action.index >= s.hand.length) return err('invalid_action', 'No such card');
      s.discard.push(...s.hand.splice(action.index, 1));
      s.phase = 'wazirEnact';
      return null;
    }

    case 'wazirEnact': {
      if (s.phase !== 'wazirEnact') return err('wrong_phase', 'Not time for the Wazir to enact');
      if (actorId !== s.nomineeId) return err('not_your_turn', 'Only the Wazir enacts');
      if (action.index >= s.hand.length) return err('invalid_action', 'No such card');
      const [decree] = s.hand.splice(action.index, 1) as [DecreeId];
      s.discard.push(...s.hand);
      s.hand = [];
      enact(ctx, decree, true);
      return null;
    }

    case 'proposeVeto': {
      if (s.phase !== 'wazirEnact') return err('wrong_phase', 'Not time to propose a veto');
      if (actorId !== s.nomineeId) return err('not_your_turn', 'Only the Wazir proposes a veto');
      if (s.enacted.rebel < VETO_UNLOCK) return err('invalid_action', 'The veto is not unlocked');
      if (s.vetoRefused) return err('invalid_action', 'The Ameer already refused the veto');
      s.phase = 'vetoPending';
      log(ctx, { type: 'vetoProposed', wazirId: actorId });
      return null;
    }

    case 'answerVeto': {
      if (s.phase !== 'vetoPending') return err('wrong_phase', 'No veto to answer');
      if (actorId !== s.ameerId) return err('not_your_turn', 'Only the Ameer answers the veto');
      log(ctx, { type: 'vetoAnswered', ameerId: actorId, accept: action.accept });
      if (action.accept) {
        s.discard.push(...s.hand);
        s.hand = [];
        addUnrest(ctx);
      } else {
        s.vetoRefused = true;
        s.phase = 'wazirEnact';
      }
      return null;
    }

    case 'investigate':
    case 'specialElection':
    case 'execution':
    case 'policyPeekDone': {
      const power = action.type === 'policyPeekDone' ? 'policyPeek' : action.type;
      if (s.phase !== 'power' || s.pendingPower !== power) {
        return err('wrong_phase', 'That power is not available');
      }
      if (actorId !== s.ameerId) return err('not_your_turn', 'Only the Ameer uses powers');

      if (action.type === 'policyPeekDone') {
        log(ctx, { type: 'powerUsed', power, ameerId: actorId });
        startNextRound(ctx);
        return null;
      }

      const { targetId } = action;
      if (targetId === actorId) return err('invalid_action', 'You cannot target yourself');
      if (action.type === 'investigate' && s.spiedIds.includes(targetId)) {
        return err('invalid_action', 'That player has already been spied on');
      }
      if (!powerTargetIds(s).includes(targetId)) {
        return err('invalid_action', 'That player cannot be targeted');
      }
      const target = s.players.find((p) => p.id === targetId) as DiwanPlayer;
      log(ctx, { type: 'powerUsed', power, ameerId: actorId, targetId });

      if (action.type === 'investigate') {
        s.spiedIds.push(targetId);
        secretsOf(s, actorId).push({ type: 'investigate', targetId, team: teamOf(target.role) });
      } else if (action.type === 'specialElection') {
        s.successorId = targetId;
        s.rotationSeat = seatOf(s, actorId);
      } else {
        target.alive = false;
        log(ctx, { type: 'exiled', targetId });
        if (target.role === 'usurper') {
          endGame(ctx, 'loyal', 'usurperExiled');
          return null;
        }
      }
      startNextRound(ctx);
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function resolveVote(ctx: Ctx): void {
  const { s } = ctx;
  const living = livingPlayers(s);
  const votes = { ...s.votes };
  const yes = living.filter((p) => votes[p.id] === 'yes').length;
  const passed = yes * 2 > living.length;
  s.votes = {};
  log(ctx, { type: 'votesRevealed', votes, passed });

  if (!passed) {
    addUnrest(ctx);
    return;
  }

  const wazirId = s.nomineeId as string;
  s.lastElected = { ameerId: s.ameerId, wazirId };
  const wazir = s.players.find((p) => p.id === wazirId) as DiwanPlayer;
  if (s.enacted.rebel >= USURPER_ELECTION_THRESHOLD && wazir.role === 'usurper') {
    endGame(ctx, 'rebel', 'usurperElected');
    return;
  }
  s.hand = drawCards(ctx, LEGISLATIVE_DRAW);
  s.vetoRefused = false;
  s.phase = 'ameerDiscard';
}

function addUnrest(ctx: Ctx): void {
  const { s } = ctx;
  s.unrest += 1;
  log(ctx, { type: 'unrest', level: s.unrest });
  if (s.unrest < UNREST_LIMIT) {
    startNextRound(ctx);
    return;
  }
  // Riot: the top decree is enacted with no power, and term limits clear.
  s.unrest = 0;
  s.lastElected = null;
  if (s.draw.length === 0) reshuffle(ctx);
  const decree = s.draw.shift() as DecreeId;
  enact(ctx, decree, false);
}

function enact(ctx: Ctx, decree: DecreeId, byGovernment: boolean): void {
  const { s } = ctx;
  s.enacted[decree] += 1;
  if (byGovernment) {
    s.unrest = 0;
    log(ctx, {
      type: 'enacted',
      decree,
      ameerId: s.ameerId,
      wazirId: s.nomineeId as string,
    });
  } else {
    log(ctx, { type: 'riot', decree });
  }

  if (s.enacted.loyal >= LOYAL_DECREES_TO_WIN) return endGame(ctx, 'loyal', 'loyalDecrees');
  if (s.enacted.rebel >= REBEL_DECREES_TO_WIN) return endGame(ctx, 'rebel', 'rebelDecrees');

  const power =
    byGovernment && decree === 'rebel' ? powerTrack(s.players.length)[s.enacted.rebel - 1] : null;
  if (!power) return startNextRound(ctx);

  s.phase = 'power';
  s.pendingPower = power;
  if (power === 'policyPeek') {
    if (s.draw.length < LEGISLATIVE_DRAW) reshuffle(ctx);
    secretsOf(s, s.ameerId).push({
      type: 'policyPeek',
      cards: s.draw.slice(0, LEGISLATIVE_DRAW),
    });
  }
}

function startNextRound(ctx: Ctx): void {
  const { s } = ctx;
  if (s.successorId !== null) {
    s.ameerId = s.successorId;
    s.successorId = null;
  } else {
    s.rotationSeat = nextLivingSeat(s, s.rotationSeat);
    s.ameerId = (s.players[s.rotationSeat] as DiwanPlayer).id;
  }
  s.phase = 'nominate';
  s.nomineeId = null;
  s.votes = {};
  s.hand = [];
  s.vetoRefused = false;
  s.pendingPower = null;
}

function endGame(ctx: Ctx, team: TeamId, reason: WinReason): void {
  const { s } = ctx;
  s.winner = { team, reason };
  s.phase = 'over';
  s.pendingPower = null;
  log(ctx, { type: 'gameOver', winner: team, reason });
}

function drawCards(ctx: Ctx, count: number): DecreeId[] {
  if (ctx.s.draw.length < count) reshuffle(ctx);
  return ctx.s.draw.splice(0, count);
}

/** Shuffles the discard pile together with what's left of the draw pile. */
function reshuffle(ctx: Ctx): void {
  const { s } = ctx;
  s.draw = shuffle([...s.draw, ...s.discard], ctx.rng);
  s.discard = [];
  log(ctx, { type: 'reshuffled', drawCount: s.draw.length });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(ctx: Ctx, entry: LogEntry): void {
  ctx.s.log.push(entry);
  ctx.events.push(entry);
}

function seatOf(s: DiwanState, playerId: string): number {
  return s.players.findIndex((p) => p.id === playerId);
}

function nextLivingSeat(s: DiwanState, fromSeat: number): number {
  const n = s.players.length;
  for (let step = 1; step <= n; step++) {
    const seat = (fromSeat + step) % n;
    if (s.players[seat]?.alive) return seat;
  }
  return fromSeat;
}

function secretsOf(s: DiwanState, playerId: string) {
  return (s.secrets[playerId] ??= []);
}

function cloneState(s: DiwanState): DiwanState {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p })),
    lastElected: s.lastElected && { ...s.lastElected },
    votes: { ...s.votes },
    draw: [...s.draw],
    discard: [...s.discard],
    hand: [...s.hand],
    enacted: { ...s.enacted },
    spiedIds: [...s.spiedIds],
    secrets: Object.fromEntries(Object.entries(s.secrets).map(([id, list]) => [id, [...list]])),
    log: [...s.log],
    winner: s.winner && { ...s.winner },
  };
}
