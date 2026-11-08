import type { CSSProperties, ReactNode } from 'react';
import { colors } from '../tokens';

/** Fine fractal grain, rendered once by the browser as a tiled background; never animated. */
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
)}")`;

export const feltBackground: CSSProperties = {
  backgroundColor: colors.feltDeep,
  backgroundImage: `${GRAIN}, radial-gradient(ellipse 70% 62% at 50% 50%, ${colors.felt} 0%, ${colors.feltDeep} 72%, ${colors.feltEdge} 100%)`,
  backgroundSize: '220px 220px, 100% 100%',
  backgroundBlendMode: 'soft-light, normal',
};

/** Deep green felt with a subtle grain and a soft vignette. */
export function Felt({
  children,
  className,
  style,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{ position: 'relative', overflow: 'hidden', ...feltBackground, ...style }}
    >
      {children}
    </div>
  );
}
