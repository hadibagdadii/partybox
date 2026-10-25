import { theme } from '@partybox/diwan';
import { useEffect, useRef } from 'react';
import type { HostScreenProps } from '../../registry';
import { LatticeBackground, StarRule } from '../ornaments';
import { herald } from '../tv/herald';
import { HeraldSettings } from '../tv/HeraldSettings';
import { Stage } from '../tv/Stage';
import { slideArt } from './slides';

/**
 * The lobby tutorial on the TV. The slide index lives on the server, so a refresh
 * lands on the same slide. The herald reads one line per slide; the caption always shows.
 */
export function TutorialTv({ room, newRoom }: HostScreenProps) {
  const { slides, progress, title } = theme.tutorial;
  const index = Math.min(room.tutorial?.slide ?? 0, slides.length - 1);
  const slide = slides[index]!;
  const Art = slideArt[index]!;
  const caption = useSlideHerald(index, slide.herald);

  return (
    <Stage>
      <LatticeBackground className="opacity-[0.06]" />
      <section
        aria-label={title}
        className="relative flex h-full flex-col items-center px-24 py-12 text-center"
      >
        <div className="flex w-full items-center justify-between">
          <p className="font-display text-tv-lg leading-none tracking-[0.2em] text-court-gold">
            {room.code}
          </p>
          <p
            className="text-tv-sm uppercase tracking-[0.2em] text-court-mist"
            data-testid="progress"
          >
            {title} · {progress(index + 1, slides.length)}
          </p>
          <HeraldSettings newRoom={newRoom} />
        </div>
        <header
          className="mt-6 flex flex-col items-center gap-3 motion-safe:animate-drop-in"
          key={index}
        >
          <h1 className="font-display text-tv-xl leading-none text-court-goldLight">
            {slide.title}
          </h1>
          <StarRule />
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center" data-testid="slide-art">
          <Art />
        </div>
        <p className="max-w-[1500px] font-serif text-tv-md leading-snug text-court-parchment">
          {slide.body}
        </p>
        <ol className="mt-8 flex gap-4" aria-hidden>
          {slides.map((_, i) => (
            <li
              key={i}
              className={`h-4 w-4 rounded-full ${i === index ? 'bg-court-goldLight' : 'bg-court-indigoLight'}`}
            />
          ))}
        </ol>
        <p
          className="mt-4 h-[48px] truncate font-serif text-tv-sm italic text-court-goldLight"
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
