import { OfficeSeal, starPoints } from '../ornaments';
import { colors } from '../tokens';

/** Up to two letters: first letters of the first two words, or one letter for one word. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = (w: string) => Array.from(w)[0] ?? '';
  if (words.length === 0) return '?';
  if (words.length === 1) return first(words[0]!).toUpperCase();
  return (first(words[0]!) + first(words[1]!)).toUpperCase();
}

/**
 * A player's medallion: initials inside a star-cut ring. No figures, per the art
 * direction. The Ameer's and Wazir's seals pin to the top right.
 */
export function Medallion({
  name,
  size,
  office = null,
  exiled = false,
}: {
  name: string;
  size: number;
  office?: 'ameer' | 'wazir' | null;
  exiled?: boolean;
}) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="-50 -50 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <polygon
          points={starPoints(16, 49, 44)}
          fill={exiled ? colors.dusk : colors.indigo}
          stroke={exiled ? colors.mist : colors.gold}
          strokeWidth={2}
        />
        <circle
          r={38}
          fill={exiled ? colors.night : colors.dusk}
          stroke={colors.goldDark}
          strokeWidth={2}
        />
      </svg>
      <span
        className={`relative font-display leading-none ${exiled ? 'text-court-mist' : 'text-court-goldLight'}`}
        style={{ fontSize: size * 0.4 }}
        aria-hidden
      >
        {initials(name)}
      </span>
      {office && (
        <OfficeSeal
          office={office}
          size={size * 0.48}
          className="absolute -right-[12%] -top-[12%] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
        />
      )}
    </span>
  );
}
