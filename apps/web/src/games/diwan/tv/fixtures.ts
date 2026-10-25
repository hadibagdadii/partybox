import type { DiwanHostView, LogEntry } from '@partybox/diwan';
import type { LobbyView } from '@partybox/shared';

/** Typed host views for tests and the /dev/diwan-host gallery; the types catch drift from the engine. */
export const fixturePlayers = [
  { id: 'p1', name: 'Amina', alive: true },
  { id: 'p2', name: 'Yusuf', alive: true },
  { id: 'p3', name: 'Layla', alive: true },
  { id: 'p4', name: 'Omar', alive: true },
  { id: 'p5', name: 'Zainab', alive: true },
  { id: 'p6', name: 'Idris', alive: true },
  { id: 'p7', name: 'Noor', alive: true },
];

const history: LogEntry[] = [
  { type: 'nominated', ameerId: 'p6', wazirId: 'p3' },
  {
    type: 'votesRevealed',
    votes: { p1: 'yes', p2: 'no', p3: 'yes', p4: 'yes', p5: 'no', p6: 'yes', p7: 'no' },
    passed: true,
  },
  { type: 'enacted', decree: 'rebel', ameerId: 'p6', wazirId: 'p3' },
];

export function hostView(overrides: Partial<DiwanHostView> = {}): DiwanHostView {
  return {
    phase: 'nominate',
    players: fixturePlayers,
    acknowledgedIds: [],
    waitingOn: ['p2'],
    ameerId: 'p2',
    nomineeId: null,
    lastElected: null,
    eligibleWazirIds: [],
    powerTargetIds: [],
    votedIds: [],
    enacted: { loyal: 1, rebel: 2 },
    unrest: 1,
    drawCount: 11,
    discardCount: 3,
    vetoUnlocked: false,
    vetoRefused: false,
    pendingPower: null,
    powerTrack: [null, 'investigate', 'specialElection', 'execution', 'execution'],
    log: history,
    winner: null,
    roles: null,
    ...overrides,
  };
}

export function fixtureRoom(view: DiwanHostView, awayIds: string[] = []): LobbyView {
  return {
    code: 'DMWN',
    gameId: 'diwan',
    gameName: 'Diwan',
    minPlayers: 5,
    maxPlayers: 10,
    phase: view.phase === 'over' ? 'over' : 'playing',
    players: view.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      isVip: i === 0,
      isBot: false,
      connected: !awayIds.includes(p.id),
      awayLong: false,
    })),
    tutorial: null,
  };
}

const ids = fixturePlayers.map((p) => p.id);
const lastElected = { ameerId: 'p6', wazirId: 'p3' };
const nominated: LogEntry = { type: 'nominated', ameerId: 'p2', wazirId: 'p4' };
const allYes = {
  p1: 'yes',
  p2: 'yes',
  p3: 'no',
  p4: 'yes',
  p5: 'yes',
  p6: 'no',
  p7: 'yes',
} as const;
const allNo = { p1: 'no', p2: 'yes', p3: 'no', p4: 'yes', p5: 'no', p6: 'no', p7: 'no' } as const;

const voting = hostView({
  phase: 'vote',
  nomineeId: 'p4',
  lastElected,
  waitingOn: ['p3', 'p5', 'p7'],
  votedIds: ['p1', 'p2', 'p4', 'p6'],
  log: [...history, nominated],
});

const enacting = hostView({
  phase: 'wazirEnact',
  nomineeId: 'p4',
  lastElected: { ameerId: 'p2', wazirId: 'p4' },
  waitingOn: ['p4'],
  drawCount: 8,
  log: [...history, nominated, { type: 'votesRevealed', votes: allYes, passed: true }],
});

const exiling = hostView({
  phase: 'power',
  ameerId: 'p2',
  nomineeId: 'p4',
  lastElected: { ameerId: 'p2', wazirId: 'p4' },
  pendingPower: 'execution',
  powerTargetIds: ids.filter((id) => id !== 'p2'),
  enacted: { loyal: 2, rebel: 4 },
  log: [
    ...history,
    nominated,
    { type: 'votesRevealed', votes: allYes, passed: true },
    { type: 'enacted', decree: 'rebel', ameerId: 'p2', wazirId: 'p4' },
  ],
});

const roles = {
  p1: 'loyal',
  p2: 'loyal',
  p3: 'rebel',
  p4: 'loyal',
  p5: 'rebel',
  p6: 'usurper',
  p7: 'loyal',
} as const;

export interface Scene {
  /** Shown first; the gallery swaps to `view` after a beat to play the moment. */
  before?: DiwanHostView;
  view: DiwanHostView;
  away?: string[];
}

/** Every TV phase, plus a before/after pair per big moment. */
export const scenes = {
  reveal: {
    view: hostView({
      phase: 'reveal',
      acknowledgedIds: ['p1', 'p3', 'p4'],
      waitingOn: ['p2', 'p5', 'p6', 'p7'],
      enacted: { loyal: 0, rebel: 0 },
      unrest: 0,
      drawCount: 17,
      discardCount: 0,
      log: [],
    }),
  },
  nominate: {
    view: hostView({
      lastElected,
      eligibleWazirIds: ['p1', 'p4', 'p5', 'p7'],
    }),
    away: ['p5'],
  },
  vote: { view: voting, away: ['p7'] },
  voteReveal: {
    before: { ...voting, waitingOn: ['p7'], votedIds: ids.filter((id) => id !== 'p7') },
    view: hostView({
      phase: 'ameerDiscard',
      nomineeId: 'p4',
      lastElected: { ameerId: 'p2', wazirId: 'p4' },
      waitingOn: ['p2'],
      drawCount: 8,
      log: [...history, nominated, { type: 'votesRevealed', votes: allYes, passed: true }],
    }),
  },
  ameerDiscard: {
    view: { ...enacting, phase: 'ameerDiscard', waitingOn: ['p2'] },
  },
  wazirEnact: { view: enacting },
  enacted: {
    before: enacting,
    view: hostView({
      ameerId: 'p3',
      waitingOn: ['p3'],
      lastElected: { ameerId: 'p2', wazirId: 'p4' },
      enacted: { loyal: 2, rebel: 2 },
      unrest: 0,
      drawCount: 8,
      discardCount: 4,
      log: [...enacting.log, { type: 'enacted', decree: 'loyal', ameerId: 'p2', wazirId: 'p4' }],
    }),
  },
  riot: {
    before: { ...voting, unrest: 2, waitingOn: ['p7'], votedIds: ids.filter((id) => id !== 'p7') },
    view: hostView({
      ameerId: 'p3',
      waitingOn: ['p3'],
      lastElected: null,
      unrest: 0,
      enacted: { loyal: 1, rebel: 2 },
      drawCount: 10,
      log: [
        ...history,
        nominated,
        { type: 'votesRevealed', votes: allNo, passed: false },
        { type: 'unrest', level: 3 },
        { type: 'riot', decree: 'rebel' },
      ],
    }),
  },
  power: { view: exiling },
  exile: {
    before: exiling,
    view: hostView({
      ameerId: 'p3',
      waitingOn: ['p3'],
      lastElected: { ameerId: 'p2', wazirId: 'p4' },
      enacted: { loyal: 2, rebel: 4 },
      players: fixturePlayers.map((p) => (p.id === 'p5' ? { ...p, alive: false } : p)),
      log: [
        ...exiling.log,
        { type: 'powerUsed', power: 'execution', ameerId: 'p2', targetId: 'p5' },
        { type: 'exiled', targetId: 'p5' },
      ],
    }),
  },
  veto: {
    view: hostView({
      phase: 'vetoPending',
      ameerId: 'p1',
      nomineeId: 'p7',
      waitingOn: ['p1'],
      enacted: { loyal: 3, rebel: 5 },
      vetoUnlocked: true,
      lastElected: { ameerId: 'p1', wazirId: 'p7' },
      log: [
        ...history,
        { type: 'nominated', ameerId: 'p1', wazirId: 'p7' },
        { type: 'votesRevealed', votes: allYes, passed: true },
        { type: 'vetoProposed', wazirId: 'p7' },
      ],
    }),
  },
  gameOver: {
    before: enacting,
    view: hostView({
      phase: 'over',
      waitingOn: [],
      enacted: { loyal: 5, rebel: 3 },
      winner: { team: 'loyal', reason: 'loyalDecrees' },
      players: fixturePlayers.map((p) => (p.id === 'p5' ? { ...p, alive: false } : p)),
      roles,
      log: [
        ...enacting.log,
        { type: 'enacted', decree: 'loyal', ameerId: 'p2', wazirId: 'p4' },
        { type: 'gameOver', winner: 'loyal', reason: 'loyalDecrees' },
      ],
    }),
  },
  gameOverRebel: {
    view: hostView({
      phase: 'over',
      waitingOn: [],
      enacted: { loyal: 2, rebel: 3 },
      winner: { team: 'rebel', reason: 'usurperElected' },
      roles,
      log: [
        ...history,
        { type: 'nominated', ameerId: 'p2', wazirId: 'p6' },
        { type: 'votesRevealed', votes: allYes, passed: true },
        { type: 'gameOver', winner: 'rebel', reason: 'usurperElected' },
      ],
    }),
  },
  tenPlayers: {
    view: hostView({
      players: [
        ...fixturePlayers,
        { id: 'p8', name: 'Hamza', alive: true },
        { id: 'p9', name: 'Safiya', alive: true },
        { id: 'p10', name: 'Bot 10', alive: true },
      ],
      powerTrack: ['investigate', 'investigate', 'specialElection', 'execution', 'execution'],
      lastElected,
    }),
  },
} satisfies Record<string, Scene>;

export type SceneId = keyof typeof scenes;
