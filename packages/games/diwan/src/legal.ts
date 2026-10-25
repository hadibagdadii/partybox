import type { DiwanAction } from './actions.js';
import { VOTE_IDS } from './ids.js';
import { eligibleWazirIds, livingPlayers, powerTargetIds } from './reduce.js';
import { VETO_UNLOCK } from './rules.js';
import type { DiwanState } from './state.js';

/** Every action `playerId` may take right now, including vote changes before the reveal. */
export function legalActions(s: DiwanState, playerId: string): DiwanAction[] {
  const me = s.players.find((p) => p.id === playerId);
  if (!me || !me.alive) return [];
  const isAmeer = playerId === s.ameerId;
  const isWazir = playerId === s.nomineeId;

  switch (s.phase) {
    case 'reveal':
      return s.acknowledgedIds.includes(playerId) ? [] : [{ type: 'acknowledge' }];
    case 'nominate':
      return isAmeer ? eligibleWazirIds(s).map((targetId) => ({ type: 'nominate', targetId })) : [];
    case 'vote':
      return VOTE_IDS.map((vote) => ({ type: 'vote', vote }));
    case 'ameerDiscard':
      return isAmeer ? s.hand.map((_, index) => ({ type: 'ameerDiscard', index })) : [];
    case 'wazirEnact': {
      if (!isWazir) return [];
      const actions: DiwanAction[] = s.hand.map((_, index) => ({ type: 'wazirEnact', index }));
      if (s.enacted.rebel >= VETO_UNLOCK && !s.vetoRefused) actions.push({ type: 'proposeVeto' });
      return actions;
    }
    case 'vetoPending':
      return isAmeer
        ? [
            { type: 'answerVeto', accept: true },
            { type: 'answerVeto', accept: false },
          ]
        : [];
    case 'power': {
      const power = s.pendingPower;
      if (!isAmeer || !power) return [];
      if (power === 'policyPeek') return [{ type: 'policyPeekDone' }];
      return powerTargetIds(s).map((targetId) => ({ type: power, targetId }));
    }
    case 'over':
      return [];
  }
}

/** Players the game cannot advance without. */
export function waitingOn(s: DiwanState): string[] {
  switch (s.phase) {
    case 'reveal':
      return s.players.filter((p) => !s.acknowledgedIds.includes(p.id)).map((p) => p.id);
    case 'vote':
      return livingPlayers(s)
        .filter((p) => s.votes[p.id] === undefined)
        .map((p) => p.id);
    case 'wazirEnact':
      return s.nomineeId ? [s.nomineeId] : [];
    case 'nominate':
    case 'ameerDiscard':
    case 'vetoPending':
    case 'power':
      return [s.ameerId];
    case 'over':
      return [];
  }
}
