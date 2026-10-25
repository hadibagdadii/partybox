import type { Rng, SeatInfo } from '@partybox/shared';
import type { DecreeId, RoleId } from './ids.js';
import { DECK_COMPOSITION, MAX_PLAYERS, MIN_PLAYERS, ROLE_SPLIT } from './rules.js';
import type { DiwanState } from './state.js';

/** Fisher-Yates, in place. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [items[i], items[j]] = [items[j] as T, items[i] as T];
  }
  return items;
}

export function freshDeck(rng: Rng): DecreeId[] {
  const deck: DecreeId[] = [
    ...Array<DecreeId>(DECK_COMPOSITION.loyal).fill('loyal'),
    ...Array<DecreeId>(DECK_COMPOSITION.rebel).fill('rebel'),
  ];
  return shuffle(deck, rng);
}

export function createInitialState(seats: readonly SeatInfo[], rng: Rng): DiwanState {
  const split = ROLE_SPLIT[seats.length];
  if (!split || seats.length < MIN_PLAYERS || seats.length > MAX_PLAYERS) {
    throw new Error(`Diwan needs ${MIN_PLAYERS}-${MAX_PLAYERS} players, got ${seats.length}`);
  }
  const roles: RoleId[] = shuffle(
    [
      ...Array<RoleId>(split.loyal).fill('loyal'),
      ...Array<RoleId>(split.rebel - 1).fill('rebel'),
      'usurper',
    ],
    rng,
  );
  const draw = freshDeck(rng);
  const firstSeat = rng.int(seats.length);
  const players = seats.map((s, i) => ({
    id: s.id,
    name: s.name,
    role: roles[i] as RoleId,
    alive: true,
  }));
  return {
    players,
    phase: 'reveal',
    acknowledgedIds: [],
    rotationSeat: firstSeat,
    ameerId: (players[firstSeat] as (typeof players)[number]).id,
    nomineeId: null,
    lastElected: null,
    votes: {},
    draw,
    discard: [],
    hand: [],
    enacted: { loyal: 0, rebel: 0 },
    unrest: 0,
    vetoRefused: false,
    pendingPower: null,
    spiedIds: [],
    successorId: null,
    secrets: Object.fromEntries(players.map((p) => [p.id, []])),
    log: [],
    winner: null,
  };
}
