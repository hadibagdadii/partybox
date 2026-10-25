import type { DiwanPlayerView } from '@partybox/diwan';
import { fixturePlayers, hostView } from '../tv/fixtures';

/** Typed player views for tests and the /dev/diwan gallery, built on the TV's host fixtures. */
export function playerView(overrides: Partial<DiwanPlayerView> = {}): DiwanPlayerView {
  return {
    ...hostView(),
    you: { id: 'p1', role: 'loyal', team: 'loyal', alive: true },
    knownRoles: { p1: 'loyal' },
    hand: null,
    myVote: null,
    secrets: [],
    peek: null,
    legalActions: [],
    ...overrides,
  };
}

const others = ['p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
const asAmeer = { ameerId: 'p1', waitingOn: ['p1'] };

/** One view per phone screen. */
export const scenarios = {
  reveal: playerView({
    phase: 'reveal',
    waitingOn: fixturePlayers.map((p) => p.id),
    you: { id: 'p1', role: 'rebel', team: 'rebel', alive: true },
    knownRoles: { p1: 'rebel', p4: 'rebel', p6: 'usurper' },
    log: [],
    legalActions: [{ type: 'acknowledge' }],
  }),
  nominate: playerView({
    ...asAmeer,
    eligibleWazirIds: ['p3', 'p4', 'p5', 'p7'],
    legalActions: ['p3', 'p4', 'p5', 'p7'].map((targetId) => ({ type: 'nominate', targetId })),
  }),
  vote: playerView({
    phase: 'vote',
    nomineeId: 'p4',
    waitingOn: ['p1', 'p3', 'p5'],
    myVote: 'yes',
    legalActions: [
      { type: 'vote', vote: 'yes' },
      { type: 'vote', vote: 'no' },
    ],
  }),
  discard: playerView({
    ...asAmeer,
    phase: 'ameerDiscard',
    nomineeId: 'p4',
    hand: ['rebel', 'loyal', 'rebel'],
    legalActions: [0, 1, 2].map((index) => ({ type: 'ameerDiscard', index })),
  }),
  enact: playerView({
    phase: 'wazirEnact',
    nomineeId: 'p1',
    waitingOn: ['p1'],
    hand: ['loyal', 'rebel'],
    legalActions: [0, 1].map((index) => ({ type: 'wazirEnact', index })),
  }),
  enactVeto: playerView({
    phase: 'wazirEnact',
    nomineeId: 'p1',
    waitingOn: ['p1'],
    enacted: { loyal: 2, rebel: 5 },
    vetoUnlocked: true,
    hand: ['rebel', 'rebel'],
    legalActions: [
      { type: 'wazirEnact', index: 0 },
      { type: 'wazirEnact', index: 1 },
      { type: 'proposeVeto' },
    ],
  }),
  vetoAnswer: playerView({
    ...asAmeer,
    phase: 'vetoPending',
    nomineeId: 'p4',
    enacted: { loyal: 2, rebel: 5 },
    vetoUnlocked: true,
    legalActions: [
      { type: 'answerVeto', accept: true },
      { type: 'answerVeto', accept: false },
    ],
  }),
  investigate: playerView({
    ...asAmeer,
    phase: 'power',
    pendingPower: 'investigate',
    powerTargetIds: others,
    legalActions: others.map((targetId) => ({ type: 'investigate', targetId })),
  }),
  successor: playerView({
    ...asAmeer,
    phase: 'power',
    pendingPower: 'specialElection',
    enacted: { loyal: 1, rebel: 3 },
    powerTargetIds: others,
    legalActions: others.map((targetId) => ({ type: 'specialElection', targetId })),
  }),
  exile: playerView({
    ...asAmeer,
    phase: 'power',
    pendingPower: 'execution',
    enacted: { loyal: 2, rebel: 4 },
    powerTargetIds: others,
    legalActions: others.map((targetId) => ({ type: 'execution', targetId })),
  }),
  scrolls: playerView({
    ...asAmeer,
    phase: 'power',
    pendingPower: 'policyPeek',
    players: fixturePlayers.slice(0, 6),
    powerTrack: [null, null, 'policyPeek', 'execution', 'execution'],
    enacted: { loyal: 1, rebel: 3 },
    peek: ['rebel', 'loyal', 'rebel'],
    legalActions: [{ type: 'policyPeekDone' }],
  }),
  spy: playerView({
    phase: 'nominate',
    ameerId: 'p2',
    secrets: [{ type: 'investigate', targetId: 'p5', team: 'rebel' }],
  }),
  waiting: playerView(),
  exiled: playerView({
    players: fixturePlayers.map((p) => (p.id === 'p1' ? { ...p, alive: false } : p)),
    you: { id: 'p1', role: 'loyal', team: 'loyal', alive: false },
    enacted: { loyal: 2, rebel: 4 },
    log: [
      ...playerView().log,
      { type: 'powerUsed', power: 'execution', ameerId: 'p5', targetId: 'p1' },
      { type: 'exiled', targetId: 'p1' },
    ],
  }),
  gameOver: playerView({
    phase: 'over',
    waitingOn: [],
    enacted: { loyal: 5, rebel: 3 },
    winner: { team: 'loyal', reason: 'loyalDecrees' },
    players: fixturePlayers.map((p) => (p.id === 'p6' ? { ...p, alive: false } : p)),
    roles: {
      p1: 'loyal',
      p2: 'loyal',
      p3: 'rebel',
      p4: 'loyal',
      p5: 'rebel',
      p6: 'usurper',
      p7: 'loyal',
    },
  }),
} satisfies Record<string, DiwanPlayerView>;

export type ScenarioId = keyof typeof scenarios;
