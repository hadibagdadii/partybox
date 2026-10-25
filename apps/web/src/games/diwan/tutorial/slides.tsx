import {
  LOYAL_DECREES_TO_WIN,
  REBEL_DECREES_TO_WIN,
  powerTrack,
  theme,
  type DecreeId,
  type RoleId,
  type VoteId,
} from '@partybox/diwan';
import type { ReactNode } from 'react';
import { Glyph } from '../ornaments';
import { colors } from '../tokens';
import { Track, UnrestMeter } from '../tv/Board';
import { fixturePlayers, hostView } from '../tv/fixtures';
import { VoteBadge } from '../tv/PlayerTiles';
import { DecreeCard } from '../ui/DecreeCard';
import { Medallion } from '../ui/Medallion';
import { TeamMark } from '../ui/TeamMark';

/** Fixture board pieces: the real components, fed made-up but well-typed data. */
const noSources: Record<DecreeId, []> = { loyal: [], rebel: [] };
const sevenPlayerBoard = hostView({
  powerTrack: [...powerTrack(7)],
  enacted: { loyal: 2, rebel: 3 },
});
const emptyBoard = hostView({ powerTrack: [...powerTrack(7)], enacted: { loyal: 0, rebel: 0 } });

const fixtureVotes: VoteId[] = ['yes', 'no', 'yes', 'yes', 'no', 'yes', 'yes'];

function Arrow() {
  return <Glyph name="arrow" size={64} color={colors.gold} />;
}

function Captioned({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="flex flex-col items-center gap-3">
      {children}
      <figcaption className="text-center font-serif text-tv-sm text-court-parchment">
        {label}
      </figcaption>
    </figure>
  );
}

function Teams() {
  const roles: RoleId[] = ['loyal', 'rebel', 'usurper'];
  return (
    <div className="flex items-end gap-24">
      {roles.map((role) => (
        <Captioned key={role} label={theme.roles[role]}>
          <TeamMark
            team={role === 'loyal' ? 'loyal' : 'rebel'}
            size={role === 'usurper' ? 150 : 120}
          />
        </Captioned>
      ))}
    </div>
  );
}

function Offices() {
  const [ameer, wazir] = [fixturePlayers[1]!, fixturePlayers[3]!];
  return (
    <div className="flex items-center gap-20">
      <Captioned label={`${theme.offices.ameer} · ${ameer.name}`}>
        <Medallion name={ameer.name} size={200} office="ameer" />
      </Captioned>
      <Arrow />
      <Captioned label={`${theme.offices.wazir} · ${wazir.name}`}>
        <Medallion name={wazir.name} size={200} office="wazir" />
      </Captioned>
    </div>
  );
}

function Votes() {
  return (
    <ul className="flex gap-8">
      {fixturePlayers.map((p, i) => (
        <li key={p.id} className="flex flex-col items-center gap-3">
          <Medallion name={p.name} size={120} />
          <VoteBadge vote={fixtureVotes[i]!} who={p.name} />
        </li>
      ))}
    </ul>
  );
}

function Decrees() {
  const hand = (decrees: DecreeId[], label: string) => (
    <Captioned label={label}>
      <div className="flex gap-3">
        {decrees.map((d, i) => (
          <div key={i} className="w-[136px]">
            <DecreeCard decree={d} size="tv" />
          </div>
        ))}
      </div>
    </Captioned>
  );
  return (
    <div className="flex items-center gap-10">
      {hand(['rebel', 'loyal', 'rebel'], theme.offices.ameer)}
      <Arrow />
      {hand(['loyal', 'rebel'], theme.offices.wazir)}
      <Arrow />
      {hand(['loyal'], theme.decrees.loyal)}
    </div>
  );
}

function Unrest() {
  return (
    <div className="flex items-center gap-12">
      <UnrestMeter value={1} />
      <Arrow />
      <UnrestMeter value={2} />
      <Arrow />
      <UnrestMeter value={3} riot />
    </div>
  );
}

function Powers() {
  return (
    <Track
      decree="rebel"
      slots={REBEL_DECREES_TO_WIN}
      view={emptyBoard}
      sources={noSources}
      shown={0}
      moment={null}
    />
  );
}

function Win() {
  const v = sevenPlayerBoard;
  return (
    <div className="flex flex-col gap-2">
      <Track
        decree="loyal"
        slots={LOYAL_DECREES_TO_WIN}
        view={v}
        sources={noSources}
        shown={v.enacted.loyal}
        moment={null}
      />
      <Track
        decree="rebel"
        slots={REBEL_DECREES_TO_WIN}
        view={v}
        sources={noSources}
        shown={v.enacted.rebel}
        moment={null}
      />
    </div>
  );
}

/** One picture per slide, in the same order as `theme.tutorial.slides`. */
export const slideArt = [Teams, Offices, Votes, Decrees, Unrest, Powers, Win] as const;
