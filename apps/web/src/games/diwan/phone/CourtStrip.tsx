import {
  LOYAL_DECREES_TO_WIN,
  REBEL_DECREES_TO_WIN,
  UNREST_LIMIT,
  theme,
  type DiwanHostView,
} from '@partybox/diwan';
import type { ReactNode } from 'react';
import type { Names } from '../format';
import { Glyph } from '../ornaments';
import { colors } from '../tokens';
import { Medallion } from '../ui/Medallion';
import { Pips } from '../ui/Pips';

/**
 * Compact court status at the top of every in-game phone screen, in the TV's
 * visual language: decree tracks, unrest, and the current government. Tapping it
 * opens the court record.
 */
export function CourtStrip({
  view,
  name,
  onOpen,
}: {
  view: DiwanHostView;
  name: Names;
  onOpen: () => void;
}) {
  const label = [
    `${theme.decrees.loyal} ${view.enacted.loyal}/${LOYAL_DECREES_TO_WIN}`,
    `${theme.decrees.rebel} ${view.enacted.rebel}/${REBEL_DECREES_TO_WIN}`,
    `${theme.electionTracker} ${view.unrest}/${UNREST_LIMIT}`,
    `${theme.offices.ameer} ${name(view.ameerId)}`,
    view.nomineeId ? `${theme.offices.wazir} ${name(view.nomineeId)}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label}. ${theme.phone.courtRecord}`}
      data-testid="court-strip"
      className="relative z-20 flex min-h-tap w-full flex-col gap-1 border-b border-court-gold/20 bg-court-dusk/90 px-safe py-1.5 text-left active:bg-court-indigo"
    >
      <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
        <Stat>
          <Pips kind="loyal" value={view.enacted.loyal} max={LOYAL_DECREES_TO_WIN} size={13} />
          <span>
            {view.enacted.loyal}/{LOYAL_DECREES_TO_WIN}
          </span>
        </Stat>
        <Stat>
          <Pips kind="rebel" value={view.enacted.rebel} max={REBEL_DECREES_TO_WIN} size={13} />
          <span>
            {view.enacted.rebel}/{REBEL_DECREES_TO_WIN}
          </span>
        </Stat>
        <Stat>
          <Pips kind="unrest" value={view.unrest} max={UNREST_LIMIT} size={13} />
          <span>
            {view.unrest}/{UNREST_LIMIT}
          </span>
        </Stat>
      </span>
      <span className="flex w-full min-w-0 items-center gap-2 text-sm">
        <Medallion name={name(view.ameerId)} size={24} office="ameer" />
        <span className="min-w-0 truncate">{name(view.ameerId)}</span>
        {view.nomineeId && (
          <>
            <Glyph name="arrow" size={16} color={colors.mist} className="shrink-0" />
            <Medallion name={name(view.nomineeId)} size={24} office="wazir" />
            <span className="min-w-0 truncate">{name(view.nomineeId)}</span>
          </>
        )}
        <span className="ml-auto shrink-0 text-xs uppercase tracking-wider text-court-mist">
          {theme.phone.courtRecord} ›
        </span>
      </span>
    </button>
  );
}

function Stat({ children }: { children: ReactNode }) {
  return <span className="flex items-center gap-1">{children}</span>;
}
