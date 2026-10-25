import { theme, type DecreeId } from '@partybox/diwan';
import { ArchFrame, CrossedBlades, Star8 } from '../ornaments';
import { colors } from '../tokens';

const sizes = {
  sm: { box: 'aspect-[3/4] pt-6', icon: 40, text: 'text-sm' },
  md: { box: 'aspect-[5/7] pt-8', icon: 52, text: 'text-base' },
  /** TV track slot: read from across the room. */
  tv: { box: 'aspect-[5/7] pt-7 pb-3', icon: 56, text: 'text-tv-sm' },
} as const;

/**
 * A decree card. Loyal and Rebel differ in color, symbol (star vs. crossed blades),
 * arch shape (round vs. ogee), and lightness, so they read without color.
 */
export function DecreeCard({
  decree,
  selected = false,
  onSelect,
  mark,
  size = 'md',
}: {
  decree: DecreeId;
  selected?: boolean;
  onSelect?: () => void;
  /** Small caption shown on the selected card, e.g. "Discard". */
  mark?: string;
  size?: 'sm' | 'md' | 'tv';
}) {
  const loyal = decree === 'loyal';
  const body = (
    <span
      className={`relative flex w-full flex-col items-center justify-end gap-2 px-2 pb-3 ${
        sizes[size].box
      }`}
      style={{ color: loyal ? colors.loyalInk : colors.rebelInk }}
    >
      <ArchFrame
        shape={loyal ? 'round' : 'ogee'}
        fill={loyal ? colors.loyal : colors.rebel}
        stroke={loyal ? colors.gold : colors.indigoLight}
      />
      <span className="relative flex flex-1 items-center">
        {loyal ? (
          <Star8 size={sizes[size].icon} fill={colors.loyalInk} stroke={colors.gold} />
        ) : (
          <CrossedBlades size={sizes[size].icon + 4} color={colors.rebelInk} />
        )}
      </span>
      <span
        className={`relative text-center font-serif font-bold leading-tight ${sizes[size].text}`}
      >
        {theme.decrees[decree]}
      </span>
      {selected && mark && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-court-goldLight px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-court-ink shadow-lift">
          {mark}
        </span>
      )}
    </span>
  );
  const label = selected && mark ? `${theme.decrees[decree]}, ${mark}` : theme.decrees[decree];
  if (!onSelect) {
    return (
      <div className="w-full" role="img" aria-label={label}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onSelect}
      className={`w-full rounded-card transition-transform duration-base ${
        selected
          ? 'motion-safe:-translate-y-2 drop-shadow-[0_0_10px_rgba(240,207,126,0.8)]'
          : 'opacity-90'
      }`}
    >
      {body}
    </button>
  );
}
