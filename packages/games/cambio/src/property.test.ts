import { createRng, type Rng } from '@partybox/shared';
import { describe, expect, it } from 'vitest';
import type { CambioAction } from './actions.js';
import { sameRank } from './cards.js';
import { cambioModule as game } from './index.js';
import { snapActions, turnActions, waitingOn } from './legal.js';
import { cardCount, findSlot, topDiscard } from './rules.js';
import type { CambioState } from './state.js';
import { facesIn } from './test-helpers.js';

/** 200 games by default; `PROPERTY_RUNS=1000 pnpm test` (or `pnpm test:full`) for more. */
const RUNS = Number(process.env.PROPERTY_RUNS ?? 200);
const STEP_CAP = 20_000;

/** Plain checks rather than `expect` in the hot loop keep thousands of games fast. */
function check(ok: boolean, seed: number, what: string): void {
  if (!ok) throw new Error(`seed ${seed}: ${what}`);
}

const pick = <T>(rng: Rng, items: readonly T[]): T => items[rng.int(items.length)] as T;

function faceDownIds(s: CambioState): Set<string> {
  return new Set([
    ...s.deck.map((c) => c.id),
    ...s.players.flatMap((p) => p.hand.map((x) => x.card.id)),
    ...(s.turn?.drawn ? [s.turn.drawn.id] : []),
  ]);
}

/** Face-down cards `playerId` may see right now, given the cards everyone saw. */
function allowedFor(s: CambioState, playerId: string, revealed: Set<string>): Set<string> {
  const ok = new Set(revealed);
  const turn = s.turn?.playerId === playerId ? s.turn : null;
  if (turn?.drawn) ok.add(turn.drawn.id);
  if (turn?.peek && (turn.stage === 'looking' || turn.stage === 'kingDecide')) {
    ok.add(turn.peek.cardId);
  }
  if (s.phase === 'peek' && !s.readyIds.includes(playerId)) {
    for (const slotId of s.peekSlotIds[playerId] ?? []) {
      const at = findSlot(s, slotId);
      if (at) ok.add(at.slot.card.id);
    }
  }
  if (s.options.rememberPeeks) {
    const mine = new Set(s.players.find((p) => p.id === playerId)!.hand.map((x) => x.card.id));
    for (const id of s.memory[playerId] ?? []) if (mine.has(id)) ok.add(id);
  }
  return ok;
}

/** A random move from a random player: mostly turn actions, sometimes an out-of-turn snap. */
function chooseMove(s: CambioState, rng: Rng): { playerId: string; action: CambioAction } {
  if (s.phase === 'play' && rng.next() < 0.2) {
    const snapper = pick(rng, s.players).id;
    let snaps = snapActions(s, snapper);
    const top = topDiscard(s);
    if (rng.next() < 0.5 && top) {
      // Half the snaps are aimed at a card that really matches.
      const right = snaps.filter((a) => {
        if (a.type !== 'snap') return false;
        const at = findSlot(s, a.slotId);
        return at !== null && sameRank(at.slot.card.face, top.face);
      });
      if (right.length > 0) snaps = right;
    }
    if (snaps.length > 0) return { playerId: snapper, action: pick(rng, snaps) };
  }
  const movers = s.players.filter((p) => turnActions(s, p.id).length > 0);
  const playerId = pick(rng, movers).id;
  const actions = turnActions(s, playerId);
  // Discard often enough that powers come up, not just swaps.
  if (actions.some((a) => a.type === 'discard') && rng.next() < 0.5) {
    return { playerId, action: { type: 'discard' } };
  }
  return { playerId, action: pick(rng, actions) };
}

interface Outcome {
  s: CambioState;
  snaps: { ok: number; failed: number };
  powers: Set<string>;
}

function playRandomGame(seed: number): Outcome {
  const picker = createRng(seed * 7919 + 17);
  const count = 2 + picker.int(11);
  const seats = Array.from({ length: count }, (_, i) => ({ id: `s${seed}-${i}`, name: `P${i}` }));
  const options = {
    scoringMode: picker.int(2) ? 'match' : 'single',
    matchTarget: 10 + picker.int(30),
    lockCaller: picker.int(2) === 1,
    rememberPeeks: picker.int(2) === 1,
  };
  const engineRng = createRng(seed);
  let s = game.createInitialState(seats, engineRng, game.optionsSchema!.parse(options));
  const total = cardCount(s);
  check(total === (count > 8 ? 108 : 54), seed, 'wrong deck size');
  // Cards everyone has seen face up while face down: wrong snaps this round.
  let revealed = new Set<string>();
  const outcome: Outcome = { s, snaps: { ok: 0, failed: 0 }, powers: new Set() };

  for (let step = 0; step < STEP_CAP && !game.isOver(s); step++) {
    const roundRevealed = s.phase === 'roundOver';
    const hidden = faceDownIds(s);
    if (!roundRevealed) {
      for (const f of facesIn(game.getHostView(s))) {
        check(!hidden.has(f.cardId) || revealed.has(f.cardId), seed, `host saw ${f.cardId}`);
      }
      // Player views are costlier, so spot-check them.
      if (step % 3 === 0) {
        for (const p of s.players) {
          const ok = allowedFor(s, p.id, revealed);
          for (const f of facesIn(game.getPlayerView(s, p.id))) {
            check(!hidden.has(f.cardId) || ok.has(f.cardId), seed, `${p.id} saw ${f.cardId}`);
          }
        }
      }
    }

    const waiting = waitingOn(s);
    check(waiting.length > 0, seed, `waiting on nobody in ${s.phase}`);
    for (const id of waiting) {
      check(turnActions(s, id).length > 0, seed, `${id} is waited on but cannot act`);
    }

    const move = chooseMove(s, picker);
    const action = game.actionSchema.parse(move.action);
    const result = game.reduce(s, { playerId: move.playerId, action }, engineRng);
    if (!result.ok) {
      throw new Error(`seed ${seed}: ${JSON.stringify(action)} ${result.error.message}`);
    }
    s = result.state;
    for (const e of result.events) {
      if (e.type === 'dealt') revealed = new Set();
      if (e.type === 'snapFailed') {
        revealed.add(e.card.cardId);
        outcome.snaps.failed += 1;
      }
      if (e.type === 'snapped') outcome.snaps.ok += 1;
      if (e.type === 'powerUsed' || e.type === 'blindSwap') outcome.powers.add(e.type);
      if (e.type === 'kingPeek' || e.type === 'kingSwap') outcome.powers.add(e.type);
    }
    check(cardCount(s) === total, seed, `card count ${cardCount(s)} != ${total}`);
  }
  outcome.s = s;
  return outcome;
}

describe('random games', () => {
  it(`${RUNS} seeded games all finish, conserve cards, and never leak a face-down card`, () => {
    const totals = { snapped: 0, failed: 0 };
    const powers = new Set<string>();
    let matches = 0;
    for (let seed = 1; seed <= RUNS; seed++) {
      const { s, snaps, powers: used } = playRandomGame(seed);
      expect(game.isOver(s), `seed ${seed} did not finish`).toBe(true);
      expect(s.winners!.length).toBeGreaterThan(0);
      totals.snapped += snaps.ok;
      totals.failed += snaps.failed;
      for (const p of used) powers.add(p);
      if (s.rounds.length > 1) matches += 1;
    }
    // The random games really exercised snaps, powers, and multi-round matches.
    expect(totals.snapped).toBeGreaterThan(0);
    expect(totals.failed).toBeGreaterThan(0);
    expect([...powers].sort()).toEqual(['blindSwap', 'kingPeek', 'kingSwap', 'powerUsed']);
    expect(matches).toBeGreaterThan(0);
  }, 300_000);
});
