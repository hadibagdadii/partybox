import {
  LOYAL_DECREES_TO_WIN,
  REBEL_DECREES_TO_WIN,
  UNREST_LIMIT,
  VETO_UNLOCK,
  theme,
  type DecreeId,
  type DiwanHostView,
  type PowerId,
} from '@partybox/diwan';
import type { Moment, TrackSource } from '../court-record';
import { ArchFrame, Glyph, Star8 } from '../ornaments';
import { colors } from '../tokens';
import { DecreeCard } from '../ui/DecreeCard';
import { Pips } from '../ui/Pips';

const powerGlyph: Record<PowerId, Parameters<typeof Glyph>[0]['name']> = {
  investigate: 'key',
  specialElection: 'arrow',
  policyPeek: 'shuffle',
  execution: 'brokenSeal',
};

export interface BoardProps {
  view: DiwanHostView;
  sources: Record<DecreeId, TrackSource[]>;
  /** Decrees per track to draw; lags the view while their moments are still queued. */
  shown: Record<DecreeId, number>;
  /** Unrest to draw; lags the view around a Riot. */
  unrest: number;
  moment: Moment | null;
}

/** The two decree tracks, the unrest meter, and the piles. */
export function Board({ view, sources, shown, unrest, moment }: BoardProps) {
  const riot = moment?.kind === 'riot';
  return (
    <div className="flex h-full items-center gap-8">
      <div className="flex flex-col gap-2">
        <Track
          decree="loyal"
          slots={LOYAL_DECREES_TO_WIN}
          view={view}
          sources={sources}
          shown={shown.loyal}
          moment={moment}
        />
        <Track
          decree="rebel"
          slots={REBEL_DECREES_TO_WIN}
          view={view}
          sources={sources}
          shown={shown.rebel}
          moment={moment}
        />
      </div>
      <div className="flex flex-1 flex-col items-center gap-8">
        <UnrestMeter value={unrest} riot={riot} />
        <div className="flex gap-6">
          <Pile label={theme.tv.draw} count={view.drawCount} />
          <Pile label={theme.tv.discard} count={view.discardCount} />
        </div>
        <p
          className={`rounded-full border-2 px-5 py-1 text-tv-sm ${
            view.vetoUnlocked
              ? 'border-court-goldLight bg-court-gold/20 text-court-goldLight motion-safe:animate-pop'
              : 'border-court-indigo text-court-mist'
          }`}
        >
          {view.vetoUnlocked ? theme.tv.vetoUnlocked : theme.tv.vetoSlot}
        </p>
      </div>
    </div>
  );
}

/** The unrest meter: pips plus a count, shaking while a Riot plays. */
export function UnrestMeter({ value, riot = false }: { value: number; riot?: boolean }) {
  return (
    <section
      aria-label={`${theme.electionTracker} ${value}/${UNREST_LIMIT}`}
      className={`flex flex-col items-center gap-3 rounded-card border-2 px-6 py-4 ${
        riot
          ? 'border-court-riot bg-court-riot/15 motion-safe:animate-shake'
          : 'border-court-indigo bg-court-dusk/70'
      }`}
    >
      <h3 className="text-tv-sm uppercase tracking-[0.15em] text-court-mist">
        {theme.electionTracker}
      </h3>
      <Pips kind="unrest" value={value} max={UNREST_LIMIT} size={52} />
      <p className="text-tv-sm" data-testid="unrest">
        {value}/{UNREST_LIMIT}
      </p>
    </section>
  );
}

/** One decree track. Exported so the tutorial draws the very same track. */
export function Track({
  decree,
  slots,
  view,
  sources,
  shown,
  moment,
}: {
  decree: DecreeId;
  slots: number;
  view: DiwanHostView;
  sources: Record<DecreeId, TrackSource[]>;
  shown: number;
  moment: Moment | null;
}) {
  const loyal = decree === 'loyal';
  return (
    <section
      aria-label={loyal ? theme.tv.loyalTrack : theme.tv.rebelTrack}
      data-testid={`track-${decree}`}
    >
      <h3
        className={`mb-1 text-tv-sm font-semibold ${loyal ? 'text-court-loyal' : 'text-court-rebelInk'}`}
      >
        {loyal ? theme.tv.loyalTrack : theme.tv.rebelTrack}
      </h3>
      <ol className="flex gap-3">
        {Array.from({ length: slots }, (_, i) => {
          const filled = i < shown;
          const arriving =
            (moment?.kind === 'enacted' || moment?.kind === 'riot') &&
            moment.decree === decree &&
            moment.slot === i;
          const byRiot = sources[decree][i] === 'riot';
          const power = loyal ? null : (view.powerTrack[i] ?? null);
          const win = i === slots - 1;
          const veto = !loyal && i + 1 === VETO_UNLOCK;
          return (
            <li
              key={i}
              className="relative w-[136px]"
              data-slot={i}
              data-filled={filled || undefined}
            >
              {filled ? (
                <div className={arriving ? 'motion-safe:animate-slot-in' : undefined}>
                  <DecreeCard decree={decree} size="tv" />
                  {byRiot && (
                    <span className="absolute left-1/2 top-1 flex -translate-x-1/2 items-center gap-1 rounded-full bg-court-riot px-3 text-tv-sm font-bold text-court-ink shadow-lift">
                      <Glyph name="burst" size={26} color={colors.ink} />
                      {theme.tv.riotTag}
                    </span>
                  )}
                </div>
              ) : (
                <EmptySlot decree={decree} power={power} win={win} />
              )}
              {veto && (
                <span
                  className={`absolute -right-2 -top-2 rounded-full p-1 ${view.vetoUnlocked ? 'bg-court-goldLight' : 'bg-court-indigo'}`}
                  title={theme.veto}
                >
                  <Glyph
                    name="ban"
                    size={28}
                    color={view.vetoUnlocked ? colors.ink : colors.mist}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EmptySlot({
  decree,
  power,
  win,
}: {
  decree: DecreeId;
  power: PowerId | null;
  win: boolean;
}) {
  const loyal = decree === 'loyal';
  return (
    <div className="relative flex aspect-[5/7] w-full flex-col items-center justify-center gap-1 px-1 pt-5 text-center">
      <ArchFrame
        shape={loyal ? 'round' : 'ogee'}
        fill={loyal ? 'rgba(207,232,216,0.06)' : 'rgba(90,22,34,0.35)'}
        stroke={loyal ? colors.goldDark : colors.indigoLight}
        className="opacity-80"
      />
      {win ? (
        <>
          <Star8 size={56} fill="none" stroke={colors.gold} className="relative" />
          <span className="relative font-serif text-tv-sm leading-none text-court-gold">
            {theme.tv.winSlot}
          </span>
        </>
      ) : power ? (
        <>
          <Glyph name={powerGlyph[power]} size={40} color={colors.power} className="relative" />
          <span className="relative break-words font-serif text-tv-sm leading-[1.05] tracking-tight text-court-parchment">
            {theme.powers[power]}
          </span>
        </>
      ) : null}
    </div>
  );
}

function Pile({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-[110px] w-[80px]">
        <span className="absolute inset-0 translate-x-2 translate-y-2 rounded-lg border-2 border-court-goldDark bg-court-indigo" />
        <span className="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-court-gold bg-court-dusk font-display text-tv-md text-court-goldLight">
          {count}
        </span>
      </div>
      <span className="text-tv-sm text-court-mist">{label}</span>
    </div>
  );
}
