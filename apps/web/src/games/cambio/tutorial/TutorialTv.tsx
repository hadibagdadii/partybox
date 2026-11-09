import { theme } from '@partybox/cambio';
import { useEffect, useRef } from 'react';
import { Stage } from '../../../components/Stage';
import { herald } from '../../../lib/herald';
import type { HostScreenProps } from '../../registry';
import { CambioSettings } from '../tv/CambioSettings';
import { colors } from '../tokens';
import { slideArt } from './slides';

/**
 * The lobby tutorial on the TV. The slide index lives on the server, so a refresh lands on the
 * same slide. The narrator reads one line per slide; the caption always shows. The animated
 * slides replay real engine fixtures with made-up players: no room state is ever drawn here.
 */
export function TutorialTv({ room, newRoom }: HostScreenProps) {
  const { slides, progress, title } = theme.tutorial;
  const index = Math.min(room.tutorial?.slide ?? 0, slides.length - 1);
  const slide = slides[index]!;
  const Art = slideArt[index]!;
  const caption = useSlideHerald(index, slide.herald);

  return (
    <Stage className="bg-[#07130f] text-cambio-chalk antialiased" outerClassName="bg-black">
      <section
        aria-label={title}
        data-testid="cambio-tutorial"
        className="absolute inset-0 flex flex-col items-center px-20 pb-8 pt-8 text-center font-card"
        style={{
          background:
            'radial-gradient(ellipse 75% 70% at 50% 52%, #0f2a20 0%, #07130f 70%, #040b08 100%)',
        }}
      >
        <div className="flex w-full items-center justify-between">
          <p
            className="font-extrabold leading-none tracking-[0.14em] [font-stretch:115%]"
            style={{ fontSize: 50, color: colors.brassLight }}
          >
            {room.code}
          </p>
          <p
            className="text-[26px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: colors.chalkDim }}
            data-testid="progress"
          >
            {title} · {progress(index + 1, slides.length)}
          </p>
          <CambioSettings newRoom={newRoom} />
        </div>
        <h1
          key={index}
          className="mt-2 text-[76px] font-extrabold leading-none tracking-[-0.01em] [font-stretch:112%] [text-wrap:balance] motion-safe:animate-drop-in"
          style={{ color: colors.chalk }}
        >
          {slide.title}
        </h1>
        <div
          className="flex min-h-0 flex-1 items-center justify-center py-4"
          data-testid="slide-art"
        >
          <Art key={index} />
        </div>
        <p
          className="max-w-[1560px] text-[30px] font-medium leading-snug [font-stretch:96%] [text-wrap:pretty]"
          style={{ color: colors.chalk }}
        >
          {slide.body}
        </p>
        <ol className="m-0 mt-4 flex list-none gap-4 p-0" aria-hidden="true">
          {slides.map((_, i) => (
            <li
              key={i}
              className="h-3.5 w-3.5 rounded-full"
              style={{ background: i === index ? colors.glow : 'rgba(233,239,233,.25)' }}
            />
          ))}
        </ol>
        <p
          className="mt-3 h-[40px] truncate text-[28px] font-medium italic"
          style={{ color: colors.brassLight }}
          data-testid="caption"
          aria-live="polite"
        >
          {caption}
        </p>
      </section>
    </Stage>
  );
}

/** Says the slide's line once per slide change and returns it as the caption. */
function useSlideHerald(index: number, line: string): string {
  // A ref, not state: StrictMode re-runs effects, and the line must be said once.
  const said = useRef<number | null>(null);
  useEffect(() => {
    if (said.current === index) return;
    said.current = index;
    herald.say(line);
  }, [index, line]);
  return line;
}
