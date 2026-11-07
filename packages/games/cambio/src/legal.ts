import type { CambioAction } from './actions.js';
import {
  canCall,
  isPeekPower,
  isSwapPower,
  kingSwapTargets,
  lockedPlayerId,
  peekTargets,
  swapPairs,
} from './rules.js';
import type { CambioState } from './state.js';

/** Every snap `playerId` may attempt now. Right or wrong is only known once it reaches the server. */
export function snapActions(s: CambioState, playerId: string): CambioAction[] {
  if (s.phase !== 'play') return [];
  const me = s.players.find((p) => p.id === playerId);
  if (!me) return [];
  const locked = lockedPlayerId(s);
  const actions: CambioAction[] = [];
  for (const owner of s.players) {
    if (owner.id !== playerId && owner.id === locked) continue;
    for (const slot of owner.hand) {
      const base = { type: 'snap', slotId: slot.id, cardId: slot.card.id } as const;
      if (owner.id === playerId || me.hand.length === 0) actions.push(base);
      else for (const give of me.hand) actions.push({ ...base, giveSlotId: give.id });
    }
  }
  return actions;
}

/** Turn actions `playerId` may take now, without snaps. */
export function turnActions(s: CambioState, playerId: string): CambioAction[] {
  const me = s.players.find((p) => p.id === playerId);
  if (!me) return [];
  switch (s.phase) {
    case 'peek':
      return s.readyIds.includes(playerId) ? [] : [{ type: 'ready' }];
    case 'roundOver':
      return [{ type: 'continue' }];
    case 'over':
      return [];
    case 'play':
      break;
  }
  const turn = s.turn;
  if (!turn || turn.playerId !== playerId) return [];
  switch (turn.stage) {
    case 'start':
      return canCall(s, playerId) ? [{ type: 'draw' }, { type: 'callCambio' }] : [{ type: 'draw' }];
    case 'drawn':
      return [
        ...me.hand.map((slot) => ({ type: 'swap', slotId: slot.id }) as const),
        { type: 'discard' },
      ];
    case 'power': {
      const power = turn.power;
      const uses: CambioAction[] = isPeekPower(power)
        ? peekTargets(s, playerId, power).map(({ slot }) => ({ type: 'peek', slotId: slot.id }))
        : isSwapPower(power)
          ? swapPairs(s, playerId, power).map((slotIds) => ({ type: 'blindSwap', slotIds }))
          : [];
      return [...uses, { type: 'skipPower' }];
    }
    case 'looking':
      return [{ type: 'donePeek' }];
    case 'kingDecide':
      return [
        ...kingSwapTargets(s).map(({ slot }) => ({ type: 'kingSwap', slotId: slot.id }) as const),
        { type: 'skipPower' },
      ];
  }
}

/** Every action `playerId` may send right now, out-of-turn snaps included. */
export function legalActions(s: CambioState, playerId: string): CambioAction[] {
  return [...turnActions(s, playerId), ...snapActions(s, playerId)];
}

/** Players the game cannot advance without. Between rounds any one player may continue. */
export function waitingOn(s: CambioState): string[] {
  switch (s.phase) {
    case 'peek':
      return s.players.filter((p) => !s.readyIds.includes(p.id)).map((p) => p.id);
    case 'play':
      return s.turn ? [s.turn.playerId] : [];
    case 'roundOver':
      return s.players.map((p) => p.id);
    case 'over':
      return [];
  }
}
