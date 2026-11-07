import type { GameError, PlayerAction, ReduceResult, Rng } from '@partybox/shared';
import type { CambioAction } from './actions.js';
import { powerOf, sameRank } from './cards.js';
import {
  canCall,
  findSlot,
  isLegalSwap,
  isPeekPower,
  isSwapPower,
  kingSwapTargets,
  lockedPlayerId,
  peekStillValid,
  peekTargets,
  powerUsable,
  topDiscard,
  type Located,
} from './rules.js';
import { matchWinners, roundWinners, scoreHand } from './scoring.js';
import { assignCardIds, dealRound, newSlot, shuffle } from './setup.js';
import type { Card, CambioEvent, CambioState, RoundResult, SlotRef, Turn } from './state.js';
import { theme } from './theme.js';

type Result = ReduceResult<CambioState, CambioEvent>;

/** The working copy of state for one action, plus the events it emits. */
interface Ctx {
  s: CambioState;
  events: CambioEvent[];
  rng: Rng;
}

const E = theme.errors;
const err = (code: GameError['code'], message: string): GameError => ({ code, message });

/** States are plain JSON data, so a JSON round trip is a full deep copy. */
const cloneState = (s: CambioState): CambioState => JSON.parse(JSON.stringify(s)) as CambioState;

export function reduce(
  prev: CambioState,
  { playerId, action }: PlayerAction<CambioAction>,
  rng: Rng,
): Result {
  if (prev.phase === 'over') return { ok: false, error: err('wrong_phase', E.gameOver) };
  if (!prev.players.some((p) => p.id === playerId)) {
    return { ok: false, error: err('not_your_turn', E.notSeated) };
  }
  const ctx: Ctx = { s: cloneState(prev), events: [], rng };
  const error = handle(ctx, playerId, action);
  if (error) return { ok: false, error };
  return { ok: true, state: ctx.s, events: ctx.events };
}

function emit(ctx: Ctx, event: CambioEvent): void {
  ctx.s.log.push(event);
  ctx.events.push(event);
}

const ref = (at: Located): SlotRef => ({
  playerId: at.owner.id,
  slotId: at.slot.id,
  cardId: at.slot.card.id,
});

const publicCard = (card: Card) => ({ cardId: card.id, face: { ...card.face } });

// ---------------------------------------------------------------------------
// Peek memory (rememberPeeks)
// ---------------------------------------------------------------------------

/** `playerId` has seen `cardId`, which is in (or just entered) their own hand. */
function remember(s: CambioState, playerId: string, cardId: string): void {
  if (!s.options.rememberPeeks) return;
  const known = (s.memory[playerId] ??= []);
  if (!known.includes(cardId)) known.push(cardId);
}

/** `cardId` moved, so nobody remembers it in place any more. */
function forget(s: CambioState, cardId: string): void {
  for (const id of Object.keys(s.memory)) {
    s.memory[id] = (s.memory[id] ?? []).filter((c) => c !== cardId);
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** The current turn, if it belongs to `actorId` and is at one of `stages`. */
function ownTurn(s: CambioState, actorId: string, stages: Turn['stage'][]): Turn | GameError {
  if (s.phase !== 'play' || !s.turn) return err('wrong_phase', E.notPlaying);
  if (s.turn.playerId !== actorId) return err('not_your_turn', E.notYourTurn);
  if (!stages.includes(s.turn.stage)) return err('wrong_phase', E.wrongStage);
  return s.turn;
}

const isError = (x: Turn | GameError): x is GameError => 'code' in x;

function handle(ctx: Ctx, actorId: string, action: CambioAction): GameError | null {
  const { s } = ctx;
  switch (action.type) {
    case 'ready': {
      if (s.phase !== 'peek') return err('wrong_phase', E.notPeekPhase);
      if (s.readyIds.includes(actorId)) return err('invalid_action', E.alreadyReady);
      s.readyIds.push(actorId);
      for (const slotId of s.peekSlotIds[actorId] ?? []) {
        const at = findSlot(s, slotId);
        if (at) remember(s, actorId, at.slot.card.id);
      }
      emit(ctx, { type: 'ready', playerId: actorId });
      if (s.players.every((p) => s.readyIds.includes(p.id)) && s.turn) {
        s.phase = 'play';
        emit(ctx, { type: 'turnStarted', playerId: s.turn.playerId });
      }
      return null;
    }

    case 'continue': {
      if (s.phase !== 'roundOver') return err('wrong_phase', E.notRoundOver);
      s.round += 1;
      dealRound(s, ctx.rng, (e) => emit(ctx, e));
      return null;
    }

    case 'draw': {
      const turn = ownTurn(s, actorId, ['start']);
      if (isError(turn)) return turn;
      const card = takeCard(ctx);
      if (!card) {
        // Nothing left anywhere to draw: the round ends here.
        endRound(ctx);
        return null;
      }
      turn.drawn = card;
      turn.stage = 'drawn';
      emit(ctx, { type: 'drew', playerId: actorId, cardId: card.id });
      return null;
    }

    case 'callCambio': {
      const turn = ownTurn(s, actorId, ['start']);
      if (isError(turn)) return turn;
      if (s.callerId !== null) return err('invalid_action', E.alreadyCalled);
      if (!canCall(s, actorId)) return err('invalid_action', E.cannotCallYet);
      s.callerId = actorId;
      emit(ctx, { type: 'cambioCalled', playerId: actorId });
      endTurn(ctx);
      return null;
    }

    case 'swap': {
      const turn = ownTurn(s, actorId, ['drawn']);
      if (isError(turn)) return turn;
      const at = findSlot(s, action.slotId);
      if (!at || at.owner.id !== actorId) return err('invalid_action', E.notYourSlot);
      const drawn = turn.drawn as Card;
      const old = at.slot.card;
      at.slot.card = drawn;
      turn.drawn = null;
      s.discard.push(old);
      forget(s, old.id);
      remember(s, actorId, drawn.id);
      emit(ctx, {
        type: 'swapped',
        playerId: actorId,
        slotId: at.slot.id,
        cardId: drawn.id,
        discarded: publicCard(old),
      });
      endTurn(ctx);
      return null;
    }

    case 'discard': {
      const turn = ownTurn(s, actorId, ['drawn']);
      if (isError(turn)) return turn;
      const drawn = turn.drawn as Card;
      turn.drawn = null;
      s.discard.push(drawn);
      emit(ctx, { type: 'discardedDrawn', playerId: actorId, card: publicCard(drawn) });
      const power = powerOf(drawn.face);
      if (power && powerUsable(s, actorId, power)) {
        turn.stage = 'power';
        turn.power = power;
      } else {
        endTurn(ctx);
      }
      return null;
    }

    case 'peek': {
      const turn = ownTurn(s, actorId, ['power']);
      if (isError(turn)) return turn;
      const power = turn.power;
      if (!isPeekPower(power)) return err('invalid_action', E.wrongStage);
      const at = findSlot(s, action.slotId);
      if (!at) return err('invalid_action', E.noSuchSlot);
      if (!peekTargets(s, actorId, power).some((t) => t.slot.id === at.slot.id)) {
        return err('invalid_action', E.badTarget);
      }
      turn.peek = ref(at);
      if (at.owner.id === actorId) remember(s, actorId, at.slot.card.id);
      if (power === 'peekSwap') {
        turn.stage = 'kingDecide';
        emit(ctx, { type: 'kingPeek', playerId: actorId, target: ref(at) });
      } else {
        turn.stage = 'looking';
        emit(ctx, { type: 'powerUsed', playerId: actorId, power, target: ref(at) });
      }
      return null;
    }

    case 'donePeek': {
      const turn = ownTurn(s, actorId, ['looking']);
      if (isError(turn)) return turn;
      endTurn(ctx);
      return null;
    }

    case 'blindSwap': {
      const turn = ownTurn(s, actorId, ['power']);
      if (isError(turn)) return turn;
      const power = turn.power;
      if (!isSwapPower(power)) return err('invalid_action', E.wrongStage);
      const [idA, idB] = action.slotIds;
      if (idA === idB) return err('invalid_action', E.sameSlot);
      const a = findSlot(s, idA);
      const b = findSlot(s, idB);
      if (!a || !b) return err('invalid_action', E.noSuchSlot);
      if (a.owner.id === b.owner.id) return err('invalid_action', E.samePlayer);
      const locked = lockedPlayerId(s);
      if (a.owner.id === locked || b.owner.id === locked) return err('invalid_action', E.locked);
      if (!isLegalSwap(s, actorId, power, a, b)) return err('invalid_action', E.badTarget);
      const event = { type: 'blindSwap', playerId: actorId, power, a: ref(a), b: ref(b) } as const;
      exchange(s, a, b);
      emit(ctx, event);
      endTurn(ctx);
      return null;
    }

    case 'kingSwap': {
      const turn = ownTurn(s, actorId, ['kingDecide']);
      if (isError(turn)) return turn;
      const peeked = peekStillValid(s);
      if (!peeked) return err('invalid_action', E.peekMoved);
      const target = findSlot(s, action.slotId);
      if (!target) return err('invalid_action', E.noSuchSlot);
      if (target.owner.id === peeked.owner.id) return err('invalid_action', E.samePlayer);
      const locked = lockedPlayerId(s);
      if (peeked.owner.id === locked || target.owner.id === locked) {
        return err('invalid_action', E.locked);
      }
      if (!kingSwapTargets(s).some((t) => t.slot.id === target.slot.id)) {
        return err('invalid_action', E.badTarget);
      }
      const event = {
        type: 'kingSwap',
        playerId: actorId,
        a: ref(peeked),
        b: ref(target),
      } as const;
      const peekedCard = peeked.slot.card.id;
      exchange(s, peeked, target);
      // The player saw the card they just moved into their own hand.
      if (target.owner.id === actorId) remember(s, actorId, peekedCard);
      emit(ctx, event);
      endTurn(ctx);
      return null;
    }

    case 'skipPower': {
      const turn = ownTurn(s, actorId, ['power', 'kingDecide']);
      if (isError(turn)) return turn;
      emit(ctx, { type: 'powerSkipped', playerId: actorId, power: turn.power ?? 'peekSwap' });
      endTurn(ctx);
      return null;
    }

    case 'snap':
      return snap(ctx, actorId, action);
  }
}

/** Swaps the cards in two slots; both cards moved, so nobody remembers them in place. */
function exchange(s: CambioState, a: Located, b: Located): void {
  const cardA = a.slot.card;
  a.slot.card = b.slot.card;
  b.slot.card = cardA;
  forget(s, a.slot.card.id);
  forget(s, b.slot.card.id);
}

function snap(
  ctx: Ctx,
  snapperId: string,
  action: Extract<CambioAction, { type: 'snap' }>,
): GameError | null {
  const { s } = ctx;
  if (s.phase !== 'play') return err('wrong_phase', E.noSnapping);
  const at = findSlot(s, action.slotId);
  // The card already left that slot, e.g. another player snapped it first.
  if (!at || at.slot.card.id !== action.cardId) return err('invalid_action', E.snapTooLate);
  const owner = at.owner;
  const own = owner.id === snapperId;
  if (!own && owner.id === lockedPlayerId(s)) return err('invalid_action', E.locked);

  const snapper = s.players.find((p) => p.id === snapperId)!;
  let give: Located | null = null;
  if (own || snapper.hand.length === 0) {
    if (action.giveSlotId !== undefined) return err('invalid_action', E.giveNotAllowed);
  } else {
    if (action.giveSlotId === undefined) return err('invalid_action', E.giveRequired);
    give = findSlot(s, action.giveSlotId);
    if (!give || give.owner.id !== snapperId) return err('invalid_action', E.notYourSlot);
  }

  const top = topDiscard(s);
  const card = at.slot.card;
  if (top && sameRank(card.face, top.face)) {
    s.discard.push(card);
    forget(s, card.id);
    if (give) {
      // The given card goes face down into the slot the snapped card left.
      at.slot.card = give.slot.card;
      snapper.hand.splice(give.index, 1);
      forget(s, give.slot.card.id);
    } else {
      owner.hand.splice(at.index, 1);
    }
    emit(ctx, {
      type: 'snapped',
      snapperId,
      ownerId: owner.id,
      slotId: at.slot.id,
      card: publicCard(card),
      give: give ? { slotId: give.slot.id, cardId: give.slot.card.id } : null,
    });
    return null;
  }

  // Wrong: everyone sees the card, it goes back, and the snapper takes a penalty card.
  if (own) remember(s, snapperId, card.id);
  const penaltyCard = takeCard(ctx);
  const penalty = penaltyCard ? newSlot(s, penaltyCard) : null;
  if (penalty) snapper.hand.push(penalty);
  emit(ctx, {
    type: 'snapFailed',
    snapperId,
    ownerId: owner.id,
    slotId: at.slot.id,
    card: publicCard(card),
    penalty: penalty ? { slotId: penalty.id, cardId: penalty.card.id } : null,
  });
  return null;
}

// ---------------------------------------------------------------------------
// Deck, turns, and round end
// ---------------------------------------------------------------------------

/**
 * The top card of the deck. An empty deck is rebuilt from the discard pile except its top card,
 * with new card ids so no one recognizes a card they saw face up. Null if there is nothing left.
 */
function takeCard(ctx: Ctx): Card | null {
  const { s } = ctx;
  if (s.deck.length === 0 && s.discard.length > 1) {
    const top = s.discard.pop() as Card;
    const faces = shuffle(
      s.discard.map((c) => c.face),
      ctx.rng,
    );
    s.discard = [top];
    s.deck = assignCardIds(s, faces, ctx.rng);
    emit(ctx, { type: 'reshuffled', deckCount: s.deck.length });
  }
  return s.deck.shift() ?? null;
}

function endTurn(ctx: Ctx): void {
  const { s } = ctx;
  const turn = s.turn as Turn;
  s.completedTurns[turn.playerId] = (s.completedTurns[turn.playerId] ?? 0) + 1;
  const seat = s.players.findIndex((p) => p.id === turn.playerId);
  const next = s.players[(seat + 1) % s.players.length]!;
  if (s.callerId !== null && next.id === s.callerId) {
    endRound(ctx);
    return;
  }
  s.turn = { playerId: next.id, stage: 'start', drawn: null, power: null, peek: null };
  emit(ctx, { type: 'turnStarted', playerId: next.id });
}

function endRound(ctx: Ctx): void {
  const { s } = ctx;
  const order = s.players.map((p) => p.id);
  const hands = s.players.map((p) => ({
    playerId: p.id,
    cards: p.hand.map((slot) => ({
      slotId: slot.id,
      cardId: slot.card.id,
      face: { ...slot.card.face },
    })),
    score: scoreHand(p.hand),
  }));
  const scores = Object.fromEntries(hands.map((h) => [h.playerId, h.score]));
  const match = s.options.scoringMode === 'match';
  s.totals = Object.fromEntries(
    order.map((id) => [id, (match ? (s.totals[id] ?? 0) : 0) + (scores[id] ?? 0)]),
  );
  const result: RoundResult = {
    round: s.round,
    callerId: s.callerId,
    hands,
    scores,
    winners: roundWinners(scores, order, s.callerId),
    totals: { ...s.totals },
  };
  s.rounds.push(result);
  s.turn = null;
  emit(ctx, { type: 'roundRevealed', result });

  const matchOver = match && order.some((id) => (s.totals[id] ?? 0) >= s.options.matchTarget);
  if (!match || matchOver) {
    s.phase = 'over';
    s.winners = match ? matchWinners(s.totals, order) : [...result.winners];
    emit(ctx, { type: 'gameOver', winners: [...s.winners], totals: { ...s.totals } });
  } else {
    s.phase = 'roundOver';
  }
}
