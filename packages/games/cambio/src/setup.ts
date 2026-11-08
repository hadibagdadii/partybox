import type { Rng, SeatInfo } from '@partybox/shared';
import {
  HAND_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PEEK_POSITIONS,
  buildFaces,
  decksFor,
  type Face,
} from './cards.js';
import { optionsSchema } from './options.js';
import type { Card, CambioEvent, CambioState, Slot } from './state.js';

/** Fisher-Yates, in place. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [items[i], items[j]] = [items[j] as T, items[i] as T];
  }
  return items;
}

/**
 * Gives each face a fresh card id. Ids are new serials in an order shuffled separately from the
 * faces, so an id says nothing about the card and never repeats within a game.
 */
export function assignCardIds(s: CambioState, faces: Face[], rng: Rng): Card[] {
  const serials = shuffle(
    Array.from({ length: faces.length }, (_, i) => s.nextCardSerial + i),
    rng,
  );
  s.nextCardSerial += faces.length;
  return faces.map((face, i) => ({ id: `c${(serials[i] as number).toString(36)}`, face }));
}

export function newSlot(s: CambioState, card: Card, pos: number): Slot {
  const slot = { id: `s${s.nextSlotSerial.toString(36)}`, card, pos };
  s.nextSlotSerial += 1;
  return slot;
}

/** The lowest grid position no card in `hand` holds: a gap first, the end of the grid otherwise. */
export function freePos(hand: readonly Slot[]): number {
  const used = new Set(hand.map((slot) => slot.pos));
  let pos = 0;
  while (used.has(pos)) pos += 1;
  return pos;
}

/** Puts `slot` into `hand`, keeping the hand sorted by position. */
export function placeSlot(hand: Slot[], slot: Slot): void {
  const at = hand.findIndex((x) => x.pos > slot.pos);
  if (at === -1) hand.push(slot);
  else hand.splice(at, 0, slot);
}

/** Shuffles a fresh deck, deals 4 to each player, flips the first discard and opens the peek. */
export function dealRound(s: CambioState, rng: Rng, emit: (e: CambioEvent) => void): void {
  const faces = shuffle(buildFaces(decksFor(s.players.length)), rng);
  const deck = assignCardIds(s, faces, rng);
  for (const p of s.players) p.hand = [];
  for (let i = 0; i < HAND_SIZE; i++) {
    for (const p of s.players) p.hand.push(newSlot(s, deck.shift() as Card, i));
  }
  const first = deck.shift() as Card;
  const firstPlayer = s.players[rng.int(s.players.length)] as (typeof s.players)[number];

  s.deck = deck;
  s.discard = [first];
  s.phase = 'peek';
  s.readyIds = [];
  s.peekSlotIds = Object.fromEntries(
    s.players.map((p) => [p.id, PEEK_POSITIONS.map((i) => (p.hand[i] as Slot).id)]),
  );
  s.turn = { playerId: firstPlayer.id, stage: 'start', drawn: null, power: null, peek: null };
  s.completedTurns = Object.fromEntries(s.players.map((p) => [p.id, 0]));
  s.callerId = null;
  s.memory = Object.fromEntries(s.players.map((p) => [p.id, []]));
  s.log = [];
  emit({
    type: 'dealt',
    round: s.round,
    firstPlayerId: firstPlayer.id,
    hands: s.players.map((p) => ({
      playerId: p.id,
      slots: p.hand.map((slot) => ({ slotId: slot.id, cardId: slot.card.id, pos: slot.pos })),
    })),
    discard: { cardId: first.id, face: { ...first.face } },
    deckCount: s.deck.length,
  });
}

/** Throws on a bad table size or bad options, like every game's setup; the room checks first. */
export function createInitialState(
  seats: readonly SeatInfo[],
  rng: Rng,
  options?: unknown,
): CambioState {
  if (seats.length < MIN_PLAYERS || seats.length > MAX_PLAYERS) {
    throw new Error(`Cambio needs ${MIN_PLAYERS}-${MAX_PLAYERS} players, got ${seats.length}`);
  }
  const s: CambioState = {
    options: optionsSchema.parse(options ?? {}),
    players: seats.map((seat) => ({ id: seat.id, name: seat.name, hand: [] })),
    round: 1,
    phase: 'peek',
    deck: [],
    discard: [],
    readyIds: [],
    peekSlotIds: {},
    turn: null,
    completedTurns: {},
    callerId: null,
    memory: {},
    totals: Object.fromEntries(seats.map((seat) => [seat.id, 0])),
    rounds: [],
    log: [],
    winners: null,
    nextSlotSerial: 1,
    nextCardSerial: 1,
  };
  dealRound(s, rng, (e) => s.log.push(e));
  return s;
}
