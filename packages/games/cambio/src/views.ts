import type { CambioAction } from './actions.js';
import type { Face } from './cards.js';
import type { Phase, PowerId, Stage } from './ids.js';
import { legalActions, waitingOn } from './legal.js';
import type { CambioOptions } from './options.js';
import { canCall, findSlot, lockedPlayerId, topDiscard } from './rules.js';
import type { CambioEvent, CambioState, PublicCard, RoundResult, SeenCard } from './state.js';

export interface CambioHostView {
  phase: Phase;
  round: number;
  options: CambioOptions;
  /** Seat order. Slots carry card ids and grid positions only, never faces. */
  players: {
    id: string;
    name: string;
    slots: { slotId: string; cardId: string; pos: number }[];
  }[];
  deckCount: number;
  discardCount: number;
  topDiscard: PublicCard | null;
  turn: {
    playerId: string;
    stage: Stage;
    /** Id of the card the player holds after drawing, face hidden. */
    drawnCardId: string | null;
    power: PowerId | null;
    /** The slot being peeked at, during `looking` and `kingDecide`. */
    peekSlotId: string | null;
    /** Whether the player may call Cambio now. */
    canCall: boolean;
  } | null;
  callerId: string | null;
  /** The caller while lockCaller protects their cards. */
  lockedPlayerId: string | null;
  /** Filled during the initial peek: who is ready. */
  readyIds: string[];
  waitingOn: string[];
  totals: Record<string, number>;
  /** The most recent finished round, with every card revealed. */
  lastRound: RoundResult | null;
  winners: string[] | null;
  /** This round's public events. */
  log: CambioEvent[];
}

export interface CambioPlayerView extends CambioHostView {
  /** Null for ids not seated in this game. */
  you: { id: string } | null;
  /** The card you drew, while you hold it. */
  drawn: PublicCard | null;
  /** Cards you are looking at right now: your bottom two during the initial peek, or a power peek. */
  peeks: SeenCard[];
  /** Cards in your hand you remember (rememberPeeks only). */
  known: SeenCard[];
  legalActions: CambioAction[];
}

const copyFace = (face: Face): Face => ({ ...face });

export function getHostView(s: CambioState): CambioHostView {
  const top = topDiscard(s);
  const turn = s.turn;
  return {
    phase: s.phase,
    round: s.round,
    options: { ...s.options },
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      slots: p.hand.map((slot) => ({ slotId: slot.id, cardId: slot.card.id, pos: slot.pos })),
    })),
    deckCount: s.deck.length,
    discardCount: s.discard.length,
    topDiscard: top && { cardId: top.id, face: copyFace(top.face) },
    turn: turn && {
      playerId: turn.playerId,
      stage: turn.stage,
      drawnCardId: turn.drawn?.id ?? null,
      power: turn.power,
      peekSlotId: turn.peek?.slotId ?? null,
      canCall: canCall(s, turn.playerId),
    },
    callerId: s.callerId,
    lockedPlayerId: lockedPlayerId(s),
    readyIds: s.phase === 'peek' ? [...s.readyIds] : [],
    waitingOn: waitingOn(s),
    totals: { ...s.totals },
    lastRound: structuredRound(s.rounds[s.rounds.length - 1]),
    winners: s.winners && [...s.winners],
    log: JSON.parse(JSON.stringify(s.log)) as CambioEvent[],
  };
}

const structuredRound = (r: RoundResult | undefined): RoundResult | null =>
  r ? (JSON.parse(JSON.stringify(r)) as RoundResult) : null;

/** The card in `slotId` with its face, if it is still `cardId`. */
function seen(s: CambioState, slotId: string, cardId?: string): SeenCard | null {
  const at = findSlot(s, slotId);
  if (!at || (cardId !== undefined && at.slot.card.id !== cardId)) return null;
  return {
    playerId: at.owner.id,
    slotId,
    cardId: at.slot.card.id,
    face: copyFace(at.slot.card.face),
  };
}

export function getPlayerView(s: CambioState, playerId: string): CambioPlayerView {
  const host = getHostView(s);
  const me = s.players.find((p) => p.id === playerId);
  if (!me) return { ...host, you: null, drawn: null, peeks: [], known: [], legalActions: [] };

  const myTurn = s.turn?.playerId === me.id ? s.turn : null;
  const peeks: SeenCard[] = [];
  if (s.phase === 'peek' && !s.readyIds.includes(me.id)) {
    for (const slotId of s.peekSlotIds[me.id] ?? []) {
      const card = seen(s, slotId);
      if (card) peeks.push(card);
    }
  }
  if (myTurn?.peek && (myTurn.stage === 'looking' || myTurn.stage === 'kingDecide')) {
    const card = seen(s, myTurn.peek.slotId, myTurn.peek.cardId);
    if (card) peeks.push(card);
  }

  const memory = s.options.rememberPeeks ? (s.memory[me.id] ?? []) : [];
  const known = me.hand
    .filter((slot) => memory.includes(slot.card.id))
    .map((slot) => ({
      playerId: me.id,
      slotId: slot.id,
      cardId: slot.card.id,
      face: copyFace(slot.card.face),
    }));

  return {
    ...host,
    you: { id: me.id },
    drawn: myTurn?.drawn ? { cardId: myTurn.drawn.id, face: copyFace(myTurn.drawn.face) } : null,
    peeks,
    known,
    legalActions: legalActions(s, me.id),
  };
}
