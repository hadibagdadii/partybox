import { theme } from '@partybox/diwan';
import { Glyph } from '../../ornaments';
import { colors } from '../../tokens';

/** A short banner across the board when someone is exiled. */
export function ExileBanner({ name }: { name: string }) {
  return (
    <div className="absolute inset-x-0 top-1/2 z-20 -translate-y-1/2" role="status">
      <div className="mx-auto flex w-fit items-center gap-6 border-y-4 border-court-exile bg-court-night/95 px-16 py-6 shadow-lift motion-safe:animate-drop-in">
        <Glyph name="brokenSeal" size={88} color={colors.exile} />
        <p className="font-display text-tv-xl leading-none text-court-parchment">
          {theme.tv.exileBanner(name)}
        </p>
      </div>
    </div>
  );
}
