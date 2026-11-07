import type { Face } from './cards.js';
import type { Phase, PowerId, Stage } from './ids.js';
import type { CambioOptions } from './options.js';

/** A physical card. `id` is opaque: random per deck, never derived from the face. */
export interface Card {
  id: string;
  face: Face;
}

/** A place in a hand. Slot ids are stable while the slot exists. */
export interface Slot {
  id: string;
  card: Card;
}

export interface CambioPlayer {
  id: string;
  name: string;
  /** Ordered; the first four are the dealt 2x2 grid, penalty cards are appended. */
  hand: Slot[];
}

/** A card whose face everyone has seen. */
export interface PublicCard {
  cardId: string;
  face: Face;
}

/** A card in a known place, face included. Only ever shown to someone allowed to see it. */
export interface SeenCard extends PublicCard {
  playerId: string;
  slotId: string;
}

/** A slot at the moment of an event. `cardId` is the card that was in it before the event. */
export interface SlotRef {
  playerId: string;
  slotId: string;
  cardId: string;
}

export interface Turn {
  playerId: string;
  stage: Stage;
  /** The card drawn this turn while the player still holds it. */
  drawn: Card | null;
  /** The power being resolved, from `power` until the turn ends. */
  power: PowerId | null;
  /** What the player peeked at, during `looking` and `kingDecide`. */
  peek: SlotRef | null;
}

export interface RevealedHand {
  playerId: string;
  cards: { slotId: string; cardId: string; face: Face }[];
  score: number;
}

export interface RoundResult {
  round: number;
  callerId: string | null;
  hands: RevealedHand[];
  scores: Record<string, number>;
  /** Lowest score, after the caller tie rule. */
  winners: string[];
  /** Running totals after this round (equal to `scores` in single mode). */
  totals: Record<string, number>;
}

/** Public record of what happened, detailed enough to animate. Never carries a hidden face. */
export type CambioEvent =
  | {
      type: 'dealt';
      round: number;
      firstPlayerId: string;
      hands: { playerId: string; slots: { slotId: string; cardId: string }[] }[];
      discard: PublicCard;
      deckCount: number;
    }
  | { type: 'ready'; playerId: string }
  | { type: 'turnStarted'; playerId: string }
  | { type: 'drew'; playerId: string; cardId: string }
  | {
      type: 'swapped';
      playerId: string;
      slotId: string;
      /** The drawn card, now face down in `slotId`. */
      cardId: string;
      discarded: PublicCard;
    }
  | { type: 'discardedDrawn'; playerId: string; card: PublicCard }
  | { type: 'powerUsed'; playerId: string; power: 'peekOwn' | 'peekOther'; target: SlotRef }
  | { type: 'powerSkipped'; playerId: string; power: PowerId }
  | {
      type: 'blindSwap';
      playerId: string;
      power: 'swapOthers' | 'swapAny';
      a: SlotRef;
      b: SlotRef;
    }
  | { type: 'kingPeek'; playerId: string; target: SlotRef }
  | { type: 'kingSwap'; playerId: string; a: SlotRef; b: SlotRef }
  | {
      type: 'snapped';
      snapperId: string;
      ownerId: string;
      slotId: string;
      card: PublicCard;
      /** The snapper's card that went face down into `slotId`; null for your own card. */
      give: { slotId: string; cardId: string } | null;
    }
  | {
      type: 'snapFailed';
      snapperId: string;
      ownerId: string;
      slotId: string;
      /** Shown to everyone, then returned face down to `slotId`. */
      card: PublicCard;
      /** Null only if no card was left anywhere to draw. */
      penalty: { slotId: string; cardId: string } | null;
    }
  | { type: 'cambioCalled'; playerId: string }
  | { type: 'reshuffled'; deckCount: number }
  | { type: 'roundRevealed'; result: RoundResult }
  | { type: 'gameOver'; winners: string[]; totals: Record<string, number> };

export type CambioEventType = CambioEvent['type'];

export interface CambioState {
  options: CambioOptions;
  /** Seat order; play passes to the next seat. */
  players: CambioPlayer[];
  round: number;
  phase: Phase;
  /** Top card first. */
  deck: Card[];
  /** Top card last. */
  discard: Card[];
  /** Players who finished their initial peek this round. */
  readyIds: string[];
  /** Each player's two bottom slots, for the initial peek. */
  peekSlotIds: Record<string, string[]>;
  /** Null between rounds and after the game. */
  turn: Turn | null;
  /** Turns each player finished this round. */
  completedTurns: Record<string, number>;
  callerId: string | null;
  /** Card ids each player remembers in their own hand (rememberPeeks only). */
  memory: Record<string, string[]>;
  totals: Record<string, number>;
  rounds: RoundResult[];
  /** This round's public events. */
  log: CambioEvent[];
  winners: string[] | null;
  nextSlotSerial: number;
  nextCardSerial: number;
}
