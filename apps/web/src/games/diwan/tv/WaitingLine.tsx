import { theme, type DiwanHostView } from '@partybox/diwan';
import type { Names } from '../format';

/** Who the game is waiting on, flagging dropped phones. */
export function WaitingLine({
  view,
  name,
  away,
}: {
  view: DiwanHostView;
  name: Names;
  away: Set<string>;
}) {
  if (view.waitingOn.length === 0) return null;
  return (
    <p className="flex min-w-0 items-center gap-3 text-tv-sm" data-testid="waiting-line">
      <span className="shrink-0 text-court-mist">{theme.tv.waitingOn}</span>
      <span className="min-w-0 truncate">
        {view.waitingOn.map((id, i) => (
          <span key={id}>
            {i > 0 && ', '}
            <span className={away.has(id) ? 'text-court-exile' : 'text-court-parchment'}>
              {name(id)}
              {away.has(id) && ` (${theme.tv.away})`}
            </span>
          </span>
        ))}
      </span>
    </p>
  );
}
