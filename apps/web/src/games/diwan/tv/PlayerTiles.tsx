import { theme, type DiwanHostView, type VoteId } from '@partybox/diwan';
import type { LobbyPlayer } from '@partybox/shared';
import { createContext, useContext } from 'react';
import { Glyph } from '../ornaments';
import { colors } from '../tokens';
import { Medallion } from '../ui/Medallion';

/** Where each tile's vote badge sits, so vote cards can fly onto it. */
export type BadgeAnchors = Map<string, HTMLElement>;
export const BadgeAnchorContext = createContext<BadgeAnchors>(new Map());

export interface TileState {
  checked: boolean;
  vote: VoteId | null;
  away: boolean;
  waiting: boolean;
  /** Just exiled: play the exile beat on this tile. */
  exiling: boolean;
}

/** A row of player tiles. */
export function TileRow({
  view,
  ids,
  stateOf,
}: {
  view: DiwanHostView;
  ids: string[];
  stateOf: (id: string) => TileState;
}) {
  return (
    <ul className="flex h-full items-center justify-around">
      {ids.map((id) => {
        const p = view.players.find((x) => x.id === id);
        return p ? <Tile key={id} view={view} player={p} state={stateOf(id)} /> : null;
      })}
    </ul>
  );
}

function Tile({
  view,
  player,
  state,
}: {
  view: DiwanHostView;
  player: DiwanHostView['players'][number];
  state: TileState;
}) {
  const anchors = useContext(BadgeAnchorContext);
  const exiled = !player.alive;
  const office =
    view.phase === 'over' || exiled
      ? null
      : player.id === view.ameerId
        ? 'ameer'
        : player.id === view.nomineeId
          ? 'wazir'
          : null;
  const termLimited =
    !exiled &&
    !!view.lastElected &&
    (view.lastElected.ameerId === player.id || view.lastElected.wazirId === player.id);
  const officeLabel = office ? theme.offices[office] : null;

  return (
    <li
      data-testid={`tile-${player.id}`}
      data-exiled={exiled || undefined}
      data-office={office ?? undefined}
      className={`relative flex w-[248px] flex-col items-center gap-1 ${
        state.exiling ? 'motion-safe:animate-shake' : ''
      }`}
    >
      <span
        className={`relative rounded-full ${state.waiting ? 'ring-4 ring-court-goldLight/80 ring-offset-4 ring-offset-court-night motion-safe:animate-pulse-ring' : ''} ${
          exiled ? 'grayscale' : ''
        }`}
      >
        <Medallion name={player.name} size={84} office={office} exiled={exiled} />
        {state.checked && (
          <span
            data-testid="tile-check"
            aria-label="ready"
            className="absolute -bottom-1 -left-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-court-night bg-court-emeraldLight motion-safe:animate-pop"
          >
            <Glyph name="check" size={30} color={colors.parchment} />
          </span>
        )}
        {exiled && (
          <span className="absolute -bottom-1 -left-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-court-night bg-court-dusk">
            <Glyph name="brokenSeal" size={30} color={colors.exile} />
          </span>
        )}
        <span
          ref={(el) => {
            if (el) anchors.set(player.id, el);
            else anchors.delete(player.id);
          }}
          className="absolute bottom-0 left-[72%]"
        >
          {state.vote && <VoteBadge vote={state.vote} who={player.name} />}
        </span>
      </span>
      <span
        className={`max-w-full truncate text-tv-sm font-semibold ${
          exiled ? 'text-court-mist line-through decoration-court-exile decoration-4' : ''
        }`}
      >
        {player.name}
      </span>
      <span className="flex h-[40px] items-center gap-2 text-tv-sm leading-none">
        {officeLabel && (
          <span className={office === 'ameer' ? 'text-court-goldLight' : 'text-court-emeraldText'}>
            {officeLabel}
          </span>
        )}
        {exiled && <span className="text-court-exile">{theme.tv.exiled}</span>}
        {!officeLabel && termLimited && (
          <span data-testid="term-limit" className="flex items-center gap-1 text-court-mist">
            <Glyph name="ban" size={26} color={colors.mist} />
            {theme.tv.termLimit}
          </span>
        )}
        {state.away && (
          <span data-testid="away" className="rounded-full bg-court-danger px-3 py-0.5 text-white">
            {theme.tv.away}
          </span>
        )}
      </span>
    </li>
  );
}

/** A face-up vote. `who` adds screen-reader text naming the voter. */
export function VoteBadge({ vote, who }: { vote: VoteId; who?: string }) {
  const yes = vote === 'yes';
  const { label, subtitle } = theme.votes[vote];
  return (
    <span
      data-testid="vote-badge"
      data-vote={vote}
      className={`inline-flex items-center rounded-full border-2 px-3 py-0.5 font-display text-tv-sm leading-tight shadow-lift motion-safe:animate-pop ${
        yes
          ? 'border-court-gold bg-court-loyal text-court-loyalInk'
          : 'border-court-indigoLight bg-court-rebel text-court-rebelInk'
      }`}
    >
      <span aria-hidden>{label}</span>
      <span className="sr-only">
        {who ? theme.tv.voteSr(who, label, subtitle) : `${label} (${subtitle})`}
      </span>
    </span>
  );
}

/** Connected state lives on the room, not in the game view. */
export function awayIds(players: LobbyPlayer[]): Set<string> {
  return new Set(players.filter((p) => !p.connected).map((p) => p.id));
}
