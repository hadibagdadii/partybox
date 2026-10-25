import { createRng, type Rng } from '@partybox/shared';
import { describe, expect, it } from 'vitest';
import type { DiwanAction } from './actions.js';
import { diwanModule as game } from './index.js';
import type { RoleId } from './ids.js';
import { legalActions, waitingOn } from './legal.js';
import { DECK_COMPOSITION } from './rules.js';
import type { DiwanState } from './state.js';

type Move = { playerId: string; action: DiwanAction };

/** Every legal move from `s`, across all players. */
function legalMoves(s: DiwanState): Move[] {
  return s.players.flatMap((p) =>
    legalActions(s, p.id).map((action) => ({ playerId: p.id, action })),
  );
}

/** 200 games by default; `PROPERTY_RUNS=1000 pnpm test` (or `pnpm test:full`) for more. */
const RUNS = Number(process.env.PROPERTY_RUNS ?? 200);

function expectedKnown(s: DiwanState, playerId: string): Record<string, RoleId> {
  const me = s.players.find((p) => p.id === playerId)!;
  const sees = me.role === 'rebel' || (me.role === 'usurper' && s.players.length <= 6);
  return Object.fromEntries(
    s.players
      .filter((p) => p.id === playerId || (sees && p.role !== 'loyal'))
      .map((p) => [p.id, p.role]),
  );
}

const FORBIDDEN_HOST_KEYS = new Set([
  'role',
  'hand',
  'draw',
  'discard',
  'secrets',
  'peek',
  'knownRoles',
]);

function forbiddenKeys(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => forbiddenKeys(v, `${path}[${i}]`));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => [
    ...(FORBIDDEN_HOST_KEYS.has(k) ? [`${path}.${k}`] : []),
    ...forbiddenKeys(v, `${path}.${k}`),
  ]);
}

function cardsConserved(s: DiwanState): boolean {
  const all = [...s.draw, ...s.discard, ...s.hand];
  const loyal = all.filter((c) => c === 'loyal').length + s.enacted.loyal;
  const rebel = all.filter((c) => c === 'rebel').length + s.enacted.rebel;
  return loyal === DECK_COMPOSITION.loyal && rebel === DECK_COMPOSITION.rebel;
}

/** Plain checks rather than `expect` in the hot loop keep thousands of games fast. */
function check(ok: boolean, seed: number, what: string): void {
  if (!ok) throw new Error(`seed ${seed}: ${what}`);
}

const sameRoles = (a: Record<string, RoleId>, b: Record<string, RoleId>): boolean =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(a).every(([k, v]) => b[k] === v);

function playRandomGame(seed: number): DiwanState {
  const picker: Rng = createRng(seed * 7919 + 17);
  const count = 5 + picker.int(6);
  const seats = Array.from({ length: count }, (_, i) => ({ id: `s${seed}-${i}`, name: `P${i}` }));
  const engineRng = createRng(seed);
  let s = game.createInitialState(seats, engineRng);

  for (let step = 0; step < 5000 && !game.isOver(s); step++) {
    const host = game.getHostView(s);
    check(host.roles === null, seed, 'host view revealed roles');
    const leaks = forbiddenKeys(host);
    check(leaks.length === 0, seed, `host view leaked ${leaks.join(', ')}`);
    for (const p of s.players) {
      const known = game.getPlayerView(s, p.id).knownRoles;
      check(sameRoles(known, expectedKnown(s, p.id)), seed, `${p.id} knows the wrong roles`);
    }

    const waiting = waitingOn(s);
    check(waiting.length > 0, seed, `waiting on nobody in ${s.phase}`);
    for (const id of waiting) {
      check(legalActions(s, id).length > 0, seed, `${id} is waited on but cannot act`);
    }
    check(
      host.waitingOn.length === waiting.length,
      seed,
      'host view disagrees about who the game waits on',
    );

    const moves = legalMoves(s);
    check(moves.length > 0, seed, `no legal moves in ${s.phase}`);
    const move = moves[picker.int(moves.length)]!;
    const action = game.actionSchema.parse(move.action);
    const result = game.reduce(s, { playerId: move.playerId, action }, engineRng);
    if (!result.ok) throw new Error(`seed ${seed}: ${move.action.type} ${result.error.message}`);
    s = result.state;
    check(cardsConserved(s), seed, 'cards were lost or duplicated');
  }
  return s;
}

describe('random games', () => {
  it(`${RUNS} seeded games all finish with a winner and never leak to the host`, () => {
    const winners = { loyal: 0, rebel: 0 };
    const reasons = new Set<string>();
    for (let seed = 1; seed <= RUNS; seed++) {
      const end = playRandomGame(seed);
      expect(game.isOver(end), `seed ${seed} did not finish`).toBe(true);
      expect(end.winner).not.toBeNull();
      winners[end.winner!.team] += 1;
      reasons.add(end.winner!.reason);
      expect(game.getHostView(end).roles).toEqual(
        Object.fromEntries(end.players.map((p) => [p.id, p.role])),
      );
    }
    expect(winners.loyal).toBeGreaterThan(0);
    expect(winners.rebel).toBeGreaterThan(0);
    expect([...reasons].sort()).toEqual(
      ['loyalDecrees', 'rebelDecrees', 'usurperElected', 'usurperExiled'].sort(),
    );
  }, 120_000);
});
