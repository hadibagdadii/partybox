import { theme } from '@partybox/diwan';
import { Crescent, Rosette12, Star8 } from '../ornaments';
import { colors } from '../tokens';

/** Role reveal: a calm night sky while everyone reads their scroll. */
export function NightScene({ seen, total }: { seen: number; total: number }) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3 text-center"
      data-testid="night-scene"
    >
      <div className="relative flex items-center justify-center text-court-gold">
        <Rosette12 size={170} className="opacity-50 motion-safe:animate-spin-slow" />
        <Crescent
          size={120}
          color={colors.goldLight}
          className="absolute motion-safe:animate-breathe"
        />
        <Star8 size={28} className="absolute -right-10 top-4 text-court-goldLight" />
        <Star8 size={18} className="absolute -left-12 bottom-8 text-court-gold" />
      </div>
      <h2 className="font-display text-tv-xl leading-none text-court-goldLight">
        {theme.tv.nightTitle}
      </h2>
      <p className="text-tv-md text-court-mist">{theme.tv.nightHint}</p>
      <p className="text-tv-md" aria-live="polite">
        {seen}/{total}
      </p>
    </div>
  );
}
