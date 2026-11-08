/**
 * Scripted event sequences from the real engine, for the web app's dev card gallery and motion
 * tests. Every event and view here comes out of `reduce` and the view projections, so the
 * fixtures can never drift from the engine's real formats. Pure and deterministic.
 */
import type { CambioAction } from './actions.js';
import type { Face } from './cards.js';
import type { CambioOptions } from './options.js';
import type { CambioEvent, CambioState } from './state.js';
import {
  act,
  actE,
  callAndFinish,
  card,
  drawAndDiscard,
  fillers,
  makeGame,
  pid,
  slot,
} from './test-helpers.js';
import { getHostView, getPlayerView, type CambioHostView, type CambioPlayerView } from './views.js';

export type FixtureId =
  | 'deal'
  | 'draw'
  | 'swap'
  | 'discard'
  | 'peekOwn'
  | 'peekOther'
  | 'blindSwap'
  | 'kingSwap'
  | 'snap'
  | 'snapGive'
  | 'wrongSnap'
  | 'reshuffle'
  | 'call'
  | 'reveal'
  | 'burst';

export const FIXTURE_IDS: readonly FixtureId[] = [
  'deal',
  'draw',
  'swap',
  'discard',
  'peekOwn',
  'peekOther',
  'blindSwap',
  'kingSwap',
  'snap',
  'snapGive',
  'wrongSnap',
  'reshuffle',
  'call',
  'reveal',
  'burst',
];

/** One broadcast: the events one action emitted and the views right after it. */
export interface FixtureStep {
  events: CambioEvent[];
  host: CambioHostView;
  /** The view of `peekerId` (seat 0), who does every turn action in these scripts. */
  peeker: CambioPlayerView;
}

export interface Fixture {
  id: FixtureId;
  playerCount: number;
  peekerId: string;
  before: { host: CambioHostView; peeker: CambioPlayerView };
  steps: FixtureStep[];
}

const NAMES = [
  'Amina',
  'Yusuf',
  'Layla',
  'Omar',
  'Zainab',
  'Idris',
  'Noor',
  'Tariq',
  'Salma',
  'Karim',
  'Huda',
  'Rami',
];

/** Varied hands so the reveal shows a spread of faces. Seats 1 and 2 hold the 5s snaps need. */
const POOL: Face[] = [
  card('A', 'hearts'),
  card('3', 'clubs'),
  card('K', 'diamonds'),
  card('8', 'spades'),
  card('Q', 'hearts'),
  card('6', 'diamonds'),
  card('joker'),
  card('10', 'clubs'),
  card('J', 'spades'),
  card('4', 'hearts'),
  card('K', 'clubs'),
  card('9', 'diamonds'),
  card('2', 'spades'),
  card('7', 'hearts'),
];

function hands(count: number): Face[][] {
  return Array.from({ length: count }, (_, seat) => {
    if (seat === 1)
      return [card('5', 'hearts'), card('6', 'clubs'), card('7', 'spades'), card('8', 'diamonds')];
    if (seat === 2)
      return [card('5', 'clubs'), card('10', 'hearts'), card('J', 'diamonds'), card('Q', 'spades')];
    return Array.from({ length: 4 }, (_, i) => POOL[(seat * 3 + i * 5) % POOL.length] as Face);
  });
}

interface Script {
  deck?: Face[];
  discard?: Face[];
  played?: boolean;
  options?: Partial<CambioOptions>;
  /** Actions before the recorded part; their events are not part of the fixture. */
  setup?: (s: CambioState) => CambioState;
  /** Recorded actions, one broadcast each. */
  actions: (
    s: CambioState,
  ) => [string, CambioAction][] | ((s: CambioState) => [string, CambioAction] | null);
}

function game(count: number, script: Script): CambioState {
  const s = makeGame({
    count,
    hands: hands(count),
    deck: script.deck ?? fillers(30),
    discard: script.discard ?? [card('9', 'clubs'), card('5', 'spades')],
    played: script.played,
    options: script.options,
  });
  s.players.forEach((p, i) => (p.name = NAMES[i] ?? p.name));
  return script.setup ? script.setup(s) : s;
}

const views = (s: CambioState) => ({ host: getHostView(s), peeker: getPlayerView(s, pid(0)) });

/** Records each action as one step. A function plan picks the next action from the live state. */
function record(s0: CambioState, plan: ReturnType<Script['actions']>): FixtureStep[] {
  const steps: FixtureStep[] = [];
  let s = s0;
  const next =
    typeof plan === 'function'
      ? plan
      : (() => {
          let i = 0;
          return () => plan[i++] ?? null;
        })();
  for (let guard = 0; guard < 200; guard++) {
    const a = next(s);
    if (!a) break;
    const r = actE(s, a[0], a[1]);
    s = r.s;
    steps.push({ events: r.events, ...views(s) });
  }
  return steps;
}

const own = (s: CambioState, seat: number, i: number) => slot(s, seat, i).id;

const scripts: Record<FixtureId, (count: number) => Script> = {
  deal: () => ({
    options: { scoringMode: 'match', matchTarget: 500 },
    played: true,
    setup: callAndFinish,
    actions: () => [[pid(0), { type: 'continue' }]],
  }),
  draw: () => ({ actions: () => [[pid(0), { type: 'draw' }]] }),
  swap: () => ({
    setup: (s) => act(s, pid(0), { type: 'draw' }),
    actions: (s) => [[pid(0), { type: 'swap', slotId: own(s, 0, 1) }]],
  }),
  discard: () => ({
    setup: (s) => act(s, pid(0), { type: 'draw' }),
    actions: () => [[pid(0), { type: 'discard' }]],
  }),
  peekOwn: () => ({
    deck: [card('7', 'clubs'), ...fillers(20)],
    setup: (s) => act(act(s, pid(0), { type: 'draw' }), pid(0), { type: 'discard' }),
    actions: (s) => [
      [pid(0), { type: 'peek', slotId: own(s, 0, 2) }],
      [pid(0), { type: 'donePeek' }],
    ],
  }),
  peekOther: (count) => ({
    deck: [card('9', 'hearts'), ...fillers(20)],
    setup: (s) => act(act(s, pid(0), { type: 'draw' }), pid(0), { type: 'discard' }),
    actions: (s) => [
      [pid(0), { type: 'peek', slotId: own(s, Math.floor(count / 2), 0) }],
      [pid(0), { type: 'donePeek' }],
    ],
  }),
  blindSwap: (count) => ({
    deck: [card('J', 'hearts'), ...fillers(20)],
    setup: (s) => act(act(s, pid(0), { type: 'draw' }), pid(0), { type: 'discard' }),
    actions: (s) => [
      [pid(0), { type: 'blindSwap', slotIds: [own(s, 1, 1), own(s, count - 1, 2)] }],
    ],
  }),
  kingSwap: (count) => ({
    deck: [card('K', 'spades'), ...fillers(20)],
    setup: (s) => act(act(s, pid(0), { type: 'draw' }), pid(0), { type: 'discard' }),
    actions: (s) => [
      [pid(0), { type: 'peek', slotId: own(s, 2, 3) }],
      [pid(0), { type: 'kingSwap', slotId: own(s, count - 2, 0) }],
    ],
  }),
  snap: () => ({
    actions: (s) => [
      [pid(1), { type: 'snap', slotId: own(s, 1, 0), cardId: slot(s, 1, 0).card.id }],
    ],
  }),
  snapGive: () => ({
    actions: (s) => [
      [
        pid(2),
        {
          type: 'snap',
          slotId: own(s, 1, 0),
          cardId: slot(s, 1, 0).card.id,
          giveSlotId: own(s, 2, 3),
        },
      ],
    ],
  }),
  wrongSnap: () => ({
    actions: (s) => [
      [pid(1), { type: 'snap', slotId: own(s, 1, 2), cardId: slot(s, 1, 2).card.id }],
    ],
  }),
  reshuffle: () => ({
    deck: [card('3', 'diamonds')],
    discard: [
      card('9', 'clubs'),
      card('4', 'spades'),
      card('A', 'diamonds'),
      card('6', 'hearts'),
      card('2', 'clubs'),
      card('8', 'hearts'),
      card('3', 'spades'),
      card('5', 'spades'),
    ],
    setup: (s) => act(act(s, pid(0), { type: 'draw' }), pid(0), { type: 'discard' }),
    actions: () => [[pid(1), { type: 'draw' }]],
  }),
  call: () => ({ played: true, actions: () => [[pid(0), { type: 'callCambio' }]] }),
  reveal: (count) => ({
    played: true,
    options: { scoringMode: 'match', matchTarget: 500 },
    setup: (s) => {
      let next = act(s, pid(0), { type: 'callCambio' });
      // Everyone but the last seat plays out; the last turn is recorded.
      for (let i = 1; i < count - 1; i++) next = drawAndDiscard(next);
      return act(next, next.turn!.playerId, { type: 'draw' });
    },
    actions: (s) => [[s.turn!.playerId, { type: 'discard' }]],
  }),
  burst: () => {
    // Quick turns with racing snaps: about 30 events in 22 broadcasts.
    let n = 0;
    return {
      deck: [card('5', 'diamonds'), card('2', 'hearts'), ...fillers(28, '3')],
      actions: () => (s) => {
        n += 1;
        if (n > 22) return null;
        const turn = s.turn!;
        if (n === 3)
          return [pid(2), { type: 'snap', slotId: own(s, 2, 0), cardId: slot(s, 2, 0).card.id }];
        if (n === 4)
          return [pid(3), { type: 'snap', slotId: own(s, 3, 0), cardId: slot(s, 3, 0).card.id }];
        if (turn.stage === 'start') return [turn.playerId, { type: 'draw' }];
        if (turn.stage === 'drawn') return [turn.playerId, { type: 'discard' }];
        return [turn.playerId, { type: 'skipPower' }];
      },
    };
  },
};

/** A fixture on a `playerCount` table (6 and 12 are the gallery's tables). */
export function buildFixture(id: FixtureId, playerCount: number): Fixture {
  const script = scripts[id](playerCount);
  const s0 = game(playerCount, script);
  return {
    id,
    playerCount,
    peekerId: pid(0),
    before: views(s0),
    steps: record(s0, script.actions(s0)),
  };
}
