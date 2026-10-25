import { theme, type DiwanHostView } from '@partybox/diwan';
import type { Names } from '../format';

/** The one short line telling the room what happens now. */
export function instruction(view: DiwanHostView, name: Names): string {
  const t = theme.tv.instruction;
  const ameer = name(view.ameerId);
  const wazir = name(view.nomineeId);
  switch (view.phase) {
    case 'reveal':
      return t.reveal();
    case 'nominate':
      return t.nominate(ameer);
    case 'vote':
      return t.vote(ameer, wazir);
    case 'ameerDiscard':
      return t.ameerDiscard(ameer);
    case 'wazirEnact':
      return t.wazirEnact(wazir);
    case 'vetoPending':
      return t.vetoPending(ameer, wazir);
    case 'power':
      return view.pendingPower ? t.power[view.pendingPower](ameer) : '';
    case 'over':
      return view.winner ? theme.winReasons[view.winner.reason] : '';
  }
}

export function PhaseBanner({ view, name }: { view: DiwanHostView; name: Names }) {
  const title =
    view.phase === 'power' && view.pendingPower
      ? theme.powers[view.pendingPower]
      : theme.phases[view.phase];
  return (
    <header
      className="flex flex-col items-center text-center"
      key={`${view.phase}:${view.ameerId}`}
    >
      <p className="text-tv-sm uppercase leading-none tracking-[0.25em] text-court-gold">{title}</p>
      <h1
        className="max-w-full truncate font-display text-tv-lg leading-tight text-court-parchment motion-safe:animate-rise"
        data-testid="instruction"
      >
        {instruction(view, name)}
      </h1>
    </header>
  );
}
