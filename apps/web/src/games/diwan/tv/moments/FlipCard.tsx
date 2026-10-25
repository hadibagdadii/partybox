import type { ReactNode } from 'react';

/**
 * A card that turns over with a 3D flip. Driven by the `up` prop and a CSS
 * transition, so if the animation clock stalls it simply lands on the final face.
 * The back is always an ornamented face, never blank.
 */
export function FlipCard({
  up,
  back,
  front,
  className = '',
}: {
  up: boolean;
  back: ReactNode;
  front: ReactNode | null;
  className?: string;
}) {
  return (
    <div
      className={`h-full w-full [perspective:1200px] ${className}`}
      data-face={up ? 'up' : 'down'}
    >
      <div
        className="relative h-full w-full transition-transform duration-slow preserve-3d"
        style={{ transform: up ? 'rotateY(180deg)' : 'none' }}
      >
        <div className="absolute inset-0 backface-hidden">{back}</div>
        {front !== null && (
          <div className="absolute inset-0 rotate-y-180 backface-hidden">{front}</div>
        )}
      </div>
    </div>
  );
}

/** Shared card back: indigo field, gold lattice star. */
export function CardBack({ children }: { children?: ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-card border-4 border-court-gold bg-gradient-to-b from-court-indigo to-court-dusk shadow-lift">
      <svg viewBox="-50 -50 100 100" className="h-3/5 w-3/5 text-court-gold" aria-hidden>
        <g fill="none" stroke="currentColor" strokeWidth={3}>
          <rect x={-30} y={-30} width={60} height={60} />
          <rect x={-30} y={-30} width={60} height={60} transform="rotate(45)" />
          <circle r={14} />
        </g>
      </svg>
      {children}
    </div>
  );
}
