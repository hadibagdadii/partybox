import { theme } from '@partybox/cambio';
import type { TutorialScreenProps } from '../../registry';
import { feltBackground } from '../motion/Felt';
import { Btn } from '../phone/ui';
import { colors } from '../tokens';

/** The VIP drives the tutorial; everyone else is pointed at the TV. */
export function TutorialPhone({ room, you, step, skip }: TutorialScreenProps) {
  const t = theme.tutorial;
  const total = room.tutorial?.total ?? t.slides.length;
  const index = Math.min(room.tutorial?.slide ?? 0, t.slides.length - 1);
  const last = index >= total - 1;
  const slide = t.slides[index]!;
  return (
    <div
      className="no-select flex h-dvh flex-col px-safe pb-safe pt-safe font-card antialiased"
      style={{ ...feltBackground, color: colors.chalk }}
    >
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 text-center">
        <p
          className="text-sm font-semibold uppercase tracking-[0.2em] tabular-nums"
          style={{ color: colors.chalkDim }}
        >
          {t.title} · {t.progress(index + 1, total)}
        </p>
        {you.isVip ? (
          <h1 className="text-4xl font-extrabold [font-stretch:110%] [text-wrap:balance]">
            {slide.title}
          </h1>
        ) : (
          <>
            <h1 className="text-4xl font-extrabold [font-stretch:110%] [text-wrap:balance]">
              {t.watchTv}
            </h1>
            <p className="text-lg [text-wrap:pretty]" style={{ color: colors.chalkDim }}>
              {t.watchTvHint}
            </p>
          </>
        )}
      </main>
      {you.isVip && (
        <div className="mx-auto flex w-full max-w-md flex-col gap-3 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <Btn big onClick={() => step('back')} disabled={index === 0}>
              {t.back}
            </Btn>
            <Btn big tone="primary" onClick={() => step('next')}>
              {last ? t.begin : t.next}
            </Btn>
          </div>
          {!last && (
            <button
              type="button"
              onClick={skip}
              className="min-h-12 rounded-[14px] text-lg font-semibold underline underline-offset-4 outline-none focus-visible:shadow-[0_0_0_3px_#f2d27a]"
              style={{ color: colors.chalk }}
            >
              {t.skip}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
