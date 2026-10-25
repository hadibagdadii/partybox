import { theme, type LogEntry } from '@partybox/diwan';
import { useMemo } from 'react';
import { groupRounds, type RecordItem, type RecordKind } from '../court-record';
import type { Names } from '../format';
import { CrossedBlades, Glyph, Star8 } from '../ornaments';
import { colors } from '../tokens';

type GlyphName = Parameters<typeof Glyph>[0]['name'];

/** One icon and color per kind, so the table can scan the record at a glance. */
const styles: Record<RecordKind, { glyph: GlyphName | 'decree' | 'star'; color: string }> = {
  nominated: { glyph: 'arrow', color: colors.mist },
  nominationPassed: { glyph: 'check', color: colors.emeraldLight },
  nominationFailed: { glyph: 'cross', color: colors.danger },
  votePassed: { glyph: 'scales', color: colors.emeraldLight },
  voteFailed: { glyph: 'scales', color: colors.danger },
  unrest: { glyph: 'flag', color: colors.goldLight },
  riot: { glyph: 'burst', color: colors.riot },
  enacted: { glyph: 'decree', color: colors.parchment },
  reshuffled: { glyph: 'shuffle', color: colors.mist },
  veto: { glyph: 'ban', color: colors.indigoLight },
  power: { glyph: 'key', color: colors.power },
  exiled: { glyph: 'brokenSeal', color: colors.exile },
  gameOver: { glyph: 'star', color: colors.gold },
};

export function RecordIcon({ item, size }: { item: RecordItem; size: number }) {
  const { glyph, color } = styles[item.kind];
  if (glyph === 'decree' || glyph === 'star') {
    return item.decree === 'rebel' ? (
      <CrossedBlades size={size} color={colors.rebelInk} />
    ) : (
      <Star8
        size={size}
        fill={glyph === 'star' ? colors.gold : colors.emeraldLight}
        stroke={colors.gold}
      />
    );
  }
  return <Glyph name={glyph} size={size} color={color} />;
}

const sizes = {
  phone: { text: 'text-base', head: 'text-sm', icon: 20, gap: 'gap-3', pad: 'px-3 py-2' },
  tv: { text: 'text-tv-sm', head: 'text-tv-sm', icon: 34, gap: 'gap-4', pad: 'px-5 py-3' },
} as const;

/** The public log grouped by round, newest round first and highlighted. */
export function CourtRecord({
  log,
  name,
  size = 'phone',
  limit,
}: {
  log: readonly LogEntry[];
  name: Names;
  size?: keyof typeof sizes;
  /** Show only the newest N rounds (the TV has no room to scroll). */
  limit?: number;
}) {
  const rounds = useMemo(() => groupRounds(log, name).reverse(), [log, name]);
  const s = sizes[size];
  if (rounds.length === 0)
    return <p className={`${s.text} text-court-mist`}>{theme.phone.emptyLog}</p>;
  return (
    <ol className={`flex flex-col ${s.gap}`} aria-label={theme.phone.courtRecord}>
      {rounds.slice(0, limit).map((round, i) => (
        <li
          key={round.number}
          data-testid="record-round"
          aria-current={i === 0 ? 'step' : undefined}
          className={`rounded-card border ${s.pad} ${
            i === 0
              ? 'border-court-gold/70 bg-court-indigo/60'
              : 'border-court-indigo bg-court-dusk/60'
          }`}
        >
          <h3
            className={`${s.head} font-semibold uppercase tracking-[0.15em] ${
              i === 0 ? 'text-court-goldLight' : 'text-court-mist'
            }`}
          >
            {theme.record.round(round.number)}
          </h3>
          <ul className="mt-1 flex flex-col gap-1">
            {round.items.map((item, j) => (
              <li key={j} data-kind={item.kind} className={`flex items-center gap-2 ${s.text}`}>
                <span className="shrink-0">
                  <RecordIcon item={item} size={s.icon} />
                </span>
                <span className="min-w-0">{item.text}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
