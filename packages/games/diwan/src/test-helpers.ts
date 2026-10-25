import { createRng, type ReduceResult } from '@partybox/shared';
import type { DiwanAction } from './actions.js';
import type { DecreeId, RoleId, VoteId } from './ids.js';
import { reduce } from './reduce.js';
import { ROLE_SPLIT } from './rules.js';
import { createInitialState } from './setup.js';
import type { DiwanState, LogEntry } from './state.js';

/** Seat ids are p0..p(n-1). */
export const pid = (seat: number): string => `p${seat}`;

/** Loyalists first, then rebels, with the Usurper in the last seat. */
export function defaultRoles(count: number): RoleId[] {
  const split = ROLE_SPLIT[count];
  if (!split) throw new Error(`bad count ${count}`);
  return [
    ...Array<RoleId>(split.loyal).fill('loyal'),
    ...Array<RoleId>(split.rebel - 1).fill('rebel'),
    'usurper',
  ];
}

export interface GameOptions {
  count?: number;
  seed?: number;
  roles?: RoleId[];
  /** Top of the draw pile first. */
  deck?: DecreeId[];
  ameerSeat?: number;
  enacted?: Partial<Record<DecreeId, number>>;
  unrest?: number;
}

/** A scripted game: known roles, a stacked deck, and the chosen first Ameer. */
export function makeGame(opts: GameOptions = {}): DiwanState {
  const count = opts.count ?? 5;
  const seats = Array.from({ length: count }, (_, i) => ({ id: pid(i), name: `Player ${i}` }));
  const state = createInitialState(seats, createRng(opts.seed ?? 1));
  const roles = opts.roles ?? defaultRoles(count);
  state.players.forEach((p, i) => (p.role = roles[i] as RoleId));
  if (opts.deck) state.draw = [...opts.deck];
  const ameerSeat = opts.ameerSeat ?? 0;
  state.rotationSeat = ameerSeat;
  state.ameerId = pid(ameerSeat);
  state.enacted = { loyal: 0, rebel: 0, ...opts.enacted };
  state.unrest = opts.unrest ?? 0;
  return state;
}

export function attempt(
  state: DiwanState,
  playerId: string,
  action: DiwanAction,
  seed = 99,
): ReduceResult<DiwanState, LogEntry> {
  return reduce(state, { playerId, action }, createRng(seed));
}

/** Applies an action that must succeed. */
export function act(state: DiwanState, playerId: string, action: DiwanAction): DiwanState {
  const result = attempt(state, playerId, action);
  if (!result.ok) throw new Error(`${playerId} ${action.type}: ${result.error.message}`);
  return result.state;
}

/** Every living player votes; `votes` overrides per player, default `vote`. */
export function voteAll(
  state: DiwanState,
  vote: VoteId = 'yes',
  votes: Record<string, VoteId> = {},
): DiwanState {
  let s = state;
  for (const p of state.players.filter((x) => x.alive)) {
    s = act(s, p.id, { type: 'vote', vote: votes[p.id] ?? vote });
  }
  return s;
}

export function elect(state: DiwanState, wazirId: string): DiwanState {
  return voteAll(act(state, state.ameerId, { type: 'nominate', targetId: wazirId }), 'yes');
}

export function failElection(state: DiwanState, wazirId: string): DiwanState {
  return voteAll(act(state, state.ameerId, { type: 'nominate', targetId: wazirId }), 'no');
}

/** From `ameerDiscard`, passes cards so the Wazir enacts `decree`. */
export function legislate(state: DiwanState, decree: DecreeId): DiwanState {
  const discardAt = state.hand.findIndex((c) => c !== decree);
  let s = act(state, state.ameerId, {
    type: 'ameerDiscard',
    index: discardAt === -1 ? 0 : discardAt,
  });
  const enactAt = s.hand.indexOf(decree);
  if (enactAt === -1) throw new Error(`no ${decree} decree in the Wazir's hand`);
  s = act(s, s.nomineeId as string, { type: 'wazirEnact', index: enactAt as 0 | 1 });
  return s;
}

/** Elects the government and enacts `decree`. */
export function passDecree(state: DiwanState, wazirId: string, decree: DecreeId): DiwanState {
  return legislate(elect(state, wazirId), decree);
}

export function lastLog(state: DiwanState): LogEntry | undefined {
  return state.log[state.log.length - 1];
}

export const rebels = (n: number): DecreeId[] => Array<DecreeId>(n).fill('rebel');
export const loyals = (n: number): DecreeId[] => Array<DecreeId>(n).fill('loyal');
