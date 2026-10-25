import { theme, type DiwanHostView, type VoteId } from '@partybox/diwan';
import { useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { voteTally } from '../../court-record';
import { BadgeAnchorContext } from '../PlayerTiles';
import { useStageScale } from '../Stage';
import { CardBack, FlipCard } from './FlipCard';

/** When the cards turn over, and when they leave for the tiles, in ms after the reveal. */
export const FLIP_AT = 500;
export const FLY_AT = 3000;

type Mode =
  | { kind: 'voting'; votedIds: string[] }
  | { kind: 'reveal'; votes: Record<string, VoteId>; passed: boolean };

/**
 * One card per living player. While voting, a card turns up face-down as each
 * player votes (who, never how). On the reveal they all flip at once, the result
 * shows, then each card flies onto its player's tile.
 */
export function VoteCards({
  view,
  mode,
  reduced,
}: {
  view: DiwanHostView;
  mode: Mode;
  reduced: boolean;
}) {
  const reveal = mode.kind === 'reveal' ? mode : null;
  const ids =
    reveal !== null
      ? view.players.filter((p) => p.id in reveal.votes).map((p) => p.id)
      : view.players.filter((p) => p.alive).map((p) => p.id);
  const [stage, setStage] = useState<'down' | 'up' | 'fly'>(reveal && reduced ? 'up' : 'down');

  const revealing = reveal !== null;
  useEffect(() => {
    if (!revealing) return;
    const timers = [setTimeout(() => setStage('up'), reduced ? 0 : FLIP_AT)];
    if (!reduced) timers.push(setTimeout(() => setStage('fly'), FLY_AT));
    return () => timers.forEach(clearTimeout);
  }, [revealing, reduced]);

  const width = Math.min(150, Math.floor((1240 - (ids.length - 1) * 16) / ids.length));
  const tally = reveal ? voteTally(reveal.votes) : null;

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-6"
      data-testid="vote-cards"
    >
      <ul className="flex items-end gap-4">
        {ids.map((id) => {
          const p = view.players.find((x) => x.id === id)!;
          const voted = reveal ? true : mode.kind === 'voting' && mode.votedIds.includes(id);
          const vote = reveal?.votes[id] ?? null;
          return (
            <li key={id} className="flex flex-col items-center gap-2" style={{ width }}>
              <Flying id={id} active={stage === 'fly'}>
                {voted ? (
                  <FlipCard
                    up={stage !== 'down'}
                    className={reveal ? '' : 'motion-safe:animate-pop'}
                    back={<CardBack />}
                    front={vote ? <VoteFace vote={vote} /> : null}
                  />
                ) : (
                  <div
                    data-face="empty"
                    className="h-full w-full rounded-card border-4 border-dashed border-court-indigoLight/70"
                  />
                )}
              </Flying>
              <span className="max-w-full truncate text-tv-sm">{p.name}</span>
            </li>
          );
        })}
      </ul>
      {reveal && tally && stage !== 'down' && (
        <p
          role="status"
          className={`rounded-full border-4 px-10 py-2 font-display text-tv-xl leading-none motion-safe:animate-pop ${
            reveal.passed
              ? 'border-court-emeraldLight bg-court-emerald/60 text-court-parchment'
              : 'border-court-danger bg-court-danger/30 text-court-parchment'
          }`}
        >
          {theme.tv.voteTally(reveal.passed, tally.yes, tally.no)}
        </p>
      )}
    </div>
  );
}

/** Card frame that can travel to the player's tile badge, measured in stage pixels. */
function Flying({ id, active, children }: { id: string; active: boolean; children: ReactNode }) {
  const anchors = useContext(BadgeAnchorContext);
  const scale = useStageScale();
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!active || !ref.current) return;
    const target = anchors.get(id);
    if (!target) return;
    const from = ref.current.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    setOffset({
      x: (to.left + to.width / 2 - (from.left + from.width / 2)) / scale,
      y: (to.top + to.height / 2 - (from.top + from.height / 2)) / scale,
    });
  }, [active, anchors, id, scale]);
  return (
    <div
      ref={ref}
      className="aspect-[5/7] w-full transition-transform duration-[800ms] ease-in"
      style={{
        transform: offset ? `translate(${offset.x}px, ${offset.y}px) scale(0.3)` : undefined,
      }}
    >
      {children}
    </div>
  );
}

function VoteFace({ vote }: { vote: VoteId }) {
  const yes = vote === 'yes';
  return (
    <div
      data-vote={vote}
      className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-card border-4 shadow-lift ${
        yes
          ? 'border-court-gold bg-court-loyal text-court-loyalInk'
          : 'border-court-indigoLight bg-court-rebel text-court-rebelInk'
      }`}
    >
      <span className="font-display text-tv-md leading-none">{theme.votes[vote].label}</span>
      <span className="text-tv-sm leading-none opacity-80">{theme.votes[vote].subtitle}</span>
    </div>
  );
}
