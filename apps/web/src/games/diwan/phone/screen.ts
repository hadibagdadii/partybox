import type { DiwanAction, DiwanPlayerView } from '@partybox/diwan';
import type { Names } from '../format';

export type ScreenId =
  | 'spyResult'
  | 'reveal'
  | 'nominate'
  | 'vote'
  | 'discard'
  | 'enact'
  | 'vetoAnswer'
  | 'powerTarget'
  | 'scrolls'
  | 'gameOver'
  | 'exiled'
  | 'waiting';

export interface ScreenProps {
  view: DiwanPlayerView;
  name: Names;
  /** Sends an action; resolves once the server has answered. */
  act: (action: DiwanAction) => void;
  /** An action is in flight; disable buttons to stop double taps. */
  busy: boolean;
}

const byActionType: Partial<Record<DiwanAction['type'], ScreenId>> = {
  acknowledge: 'reveal',
  nominate: 'nominate',
  vote: 'vote',
  ameerDiscard: 'discard',
  wazirEnact: 'enact',
  proposeVeto: 'enact',
  answerVeto: 'vetoAnswer',
  investigate: 'powerTarget',
  specialElection: 'powerTarget',
  execution: 'powerTarget',
  policyPeekDone: 'scrolls',
};

/**
 * Which screen to show. Driven by the server's legal actions, so the phone never
 * decides on its own whose turn it is; phase is only used once there is nothing to do.
 */
export function pickScreen(view: DiwanPlayerView, unseenSpy: boolean): ScreenId {
  if (view.phase === 'over') return 'gameOver';
  if (unseenSpy) return 'spyResult';
  const first = view.legalActions[0];
  const fromAction = first && byActionType[first.type];
  if (fromAction) return fromAction;
  if (view.you && !view.you.alive) return 'exiled';
  return 'waiting';
}

/** Legal actions of one type, narrowed. */
export function actionsOf<T extends DiwanAction['type']>(
  view: DiwanPlayerView,
  type: T,
): Extract<DiwanAction, { type: T }>[] {
  return view.legalActions.filter((a): a is Extract<DiwanAction, { type: T }> => a.type === type);
}
