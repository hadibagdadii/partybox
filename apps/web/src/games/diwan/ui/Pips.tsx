import { CrossedBlades, Star8 } from '../ornaments';
import { colors } from '../tokens';

/**
 * A short row of pips for a count out of a maximum: stars for Loyal, blades for
 * Rebel, rings for Unrest. Shape carries meaning as well as color.
 */
export function Pips({
  kind,
  value,
  max,
  size,
}: {
  kind: 'loyal' | 'rebel' | 'unrest';
  value: number;
  max: number;
  size: number;
}) {
  return (
    <span className="inline-flex items-center" style={{ gap: size * 0.2 }} aria-hidden>
      {Array.from({ length: max }, (_, i) => {
        const on = i < value;
        if (kind === 'loyal') {
          return (
            <Star8
              key={i}
              size={size}
              fill={on ? colors.emeraldLight : 'none'}
              stroke={on ? colors.gold : colors.indigoLight}
            />
          );
        }
        if (kind === 'rebel') {
          return (
            <CrossedBlades key={i} size={size} color={on ? colors.rebelInk : colors.indigoLight} />
          );
        }
        return (
          <svg key={i} viewBox="-10 -10 20 20" width={size} height={size}>
            <circle
              r={7.5}
              fill={on ? colors.danger : 'none'}
              stroke={on ? colors.riot : colors.indigoLight}
              strokeWidth={2}
            />
          </svg>
        );
      })}
    </span>
  );
}
