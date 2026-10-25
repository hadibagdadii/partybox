import { theme } from '@partybox/diwan';
import type { TutorialScreenProps } from '../../registry';
import { LatticeBackground, Rosette12 } from '../ornaments';
import { Button, Frame, Title } from '../phone/ui';

/** The VIP drives the tutorial; everyone else is pointed at the TV. */
export function TutorialPhone({ room, you, step, skip }: TutorialScreenProps) {
  const t = theme.tutorial;
  const total = room.tutorial?.total ?? t.slides.length;
  const index = Math.min(room.tutorial?.slide ?? 0, t.slides.length - 1);
  const last = index >= total - 1;
  const slide = t.slides[index]!;
  return (
    <div className="no-select relative flex h-dvh flex-col overflow-hidden bg-court-night pt-safe text-court-parchment">
      <LatticeBackground className="opacity-[0.07]" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <Frame
          actions={
            you.isVip && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="secondary" onClick={() => step('back')} disabled={index === 0}>
                    {t.back}
                  </Button>
                  <Button onClick={() => step('next')}>{last ? t.begin : t.next}</Button>
                </div>
                {!last && (
                  <Button variant="ghost" onClick={skip}>
                    {t.skip}
                  </Button>
                )}
              </>
            )
          }
        >
          <div className="flex flex-col items-center gap-1 pt-2">
            <Rosette12 size={88} className="text-court-gold motion-safe:animate-spin-slow" />
            <p className="text-sm uppercase tracking-[0.3em] text-court-mist">
              {t.title} · {t.progress(index + 1, total)}
            </p>
          </div>
          {you.isVip ? (
            <Title>{slide.title}</Title>
          ) : (
            <Title hint={t.watchTvHint}>{t.watchTv}</Title>
          )}
        </Frame>
      </div>
    </div>
  );
}
