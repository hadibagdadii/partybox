import type { TeamId } from '@partybox/diwan';
import { CrossedBlades, Star8 } from '../ornaments';
import { colors } from '../tokens';

/** Team badge with a distinct symbol per team, like the decree cards. */
export function TeamMark({ team, size = 22 }: { team: TeamId; size?: number }) {
  return team === 'loyal' ? (
    <Star8 size={size} fill={colors.emeraldLight} stroke={colors.gold} />
  ) : (
    <CrossedBlades size={size} color="#d9534f" />
  );
}
