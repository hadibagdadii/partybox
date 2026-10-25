import { useId, type ReactNode } from 'react';
import { colors } from './tokens';

/** Points of an n-pointed star polygon centered on (cx, cy). */
export function starPoints(n: number, outer: number, inner: number, cx = 0, cy = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** An 8-point khatam: two squares turned 45° apart. */
export function Star8({
  size = 24,
  fill = 'currentColor',
  stroke = 'none',
  className,
}: {
  size?: number;
  fill?: string;
  stroke?: string;
  className?: string;
}) {
  return (
    <svg viewBox="-12 -12 24 24" width={size} height={size} className={className} aria-hidden>
      <polygon
        points={starPoints(8, 11, 11 * 0.7654)}
        fill={fill}
        stroke={stroke}
        strokeWidth={1}
      />
      <polygon points={starPoints(8, 5.2, 5.2 * 0.7654)} fill="none" stroke={stroke} />
    </svg>
  );
}

/** A 12-point girih rosette with an inner ring of petals. */
export function Rosette12({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} className={className} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.4}>
        <polygon points={starPoints(12, 48, 36)} />
        <polygon points={starPoints(12, 34, 26)} />
        <circle r={20} />
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            x1={0}
            y1={-20}
            x2={0}
            y2={-34}
            transform={`rotate(${i * 30 + 15})`}
            strokeOpacity={0.6}
          />
        ))}
        <polygon points={starPoints(8, 12, 12 * 0.7654)} />
      </g>
    </svg>
  );
}

/**
 * Tiling girih lattice: 8-point stars joined by a diagonal strapwork grid with
 * small cross tiles between them. Meant as a low-opacity page background.
 */
export function LatticeBackground({ className = '' }: { className?: string }) {
  const id = useId();
  return (
    <svg className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden>
      <defs>
        <pattern id={id} width={56} height={56} patternUnits="userSpaceOnUse">
          <g fill="none" stroke={colors.gold} strokeWidth={0.8}>
            <polygon points={starPoints(8, 14, 14 * 0.7654, 28, 28)} />
            <polygon points={starPoints(4, 7, 3, 0, 0)} />
            <polygon points={starPoints(4, 7, 3, 56, 0)} />
            <polygon points={starPoints(4, 7, 3, 0, 56)} />
            <polygon points={starPoints(4, 7, 3, 56, 56)} />
            <path d="M5 5 L18 18 M38 18 L51 5 M5 51 L18 38 M38 38 L51 51" />
            <path d="M28 0 V12 M28 44 V56 M0 28 H12 M44 28 H56" strokeOpacity={0.6} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** A horizontal band of small stars, used as a divider under headings. */
export function StarRule({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-court-gold ${className}`}>
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-court-gold/70" />
      <Star8 size={14} />
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-court-gold/70" />
    </div>
  );
}

/** Wax seal with a scalloped edge and an embossed star. */
export function WaxSeal({ size = 88, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} className={className} aria-hidden>
      <polygon points={starPoints(18, 48, 43)} fill={colors.seal} />
      <circle r={40} fill={colors.seal} />
      <circle r={33} fill="none" stroke={colors.sealDark} strokeWidth={3} />
      <polygon
        points={starPoints(8, 24, 24 * 0.7654)}
        fill={colors.sealDark}
        stroke="#c6464b"
        strokeWidth={1.2}
      />
      <circle r={7} fill="#c6464b" />
      <ellipse cx={-16} cy={-22} rx={10} ry={5} fill="#fff" opacity={0.12} />
    </svg>
  );
}

/** A parchment scroll with rolled ends at top and bottom. */
export function Scroll({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative mx-2 ${className}`}>
      <div className="absolute -inset-x-2 top-0 h-5 rounded-full bg-gradient-to-b from-court-parchmentDark via-court-parchment to-court-goldDark shadow-lift" />
      <div className="relative mx-0 mt-2.5 bg-court-parchment px-5 py-8 text-court-ink shadow-lift">
        {children}
      </div>
      <div className="absolute -inset-x-2 bottom-0 h-5 translate-y-2.5 rounded-full bg-gradient-to-b from-court-goldDark via-court-parchment to-court-parchmentDark shadow-lift" />
    </div>
  );
}

/** Pointed (two-centered) arch outline filling its box; for frames and card tops. */
export function ArchFrame({
  className = '',
  stroke = colors.gold,
  fill = 'none',
  shape = 'pointed',
}: {
  className?: string;
  stroke?: string;
  fill?: string;
  shape?: 'pointed' | 'round' | 'ogee';
}) {
  const d = {
    pointed: 'M2 140 V46 C2 22 30 8 50 2 C70 8 98 22 98 46 V140 Z',
    round: 'M2 140 V44 C2 18 24 2 50 2 C76 2 98 18 98 44 V140 Z',
    ogee: 'M2 140 V40 C2 26 18 22 34 16 C44 12 48 8 50 1 C52 8 56 12 66 16 C82 22 98 26 98 40 V140 Z',
  }[shape];
  return (
    <svg
      viewBox="0 0 100 142"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden
    >
      <path d={d} fill={fill} stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Two crossed curved blades: the Rebel Decree symbol. */
export function CrossedBlades({
  size = 40,
  color = 'currentColor',
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  const blade = (
    <g>
      <path d="M-2.5 16 L-2.5 -6 Q-1.5 -19 7 -27 Q2.5 -14 2.5 -6 L2.5 16 Z" fill={color} />
      <rect x={-9} y={14} width={18} height={3.5} rx={1.5} fill={color} />
      <rect x={-2} y={17.5} width={4} height={9} rx={1.5} fill={color} />
      <circle cy={28.5} r={2.6} fill={color} />
    </g>
  );
  return (
    <svg viewBox="-32 -32 64 64" width={size} height={size} className={className} aria-hidden>
      <g transform="rotate(-38)">{blade}</g>
      <g transform="rotate(38) scale(-1 1)">{blade}</g>
    </svg>
  );
}

/** Crescent moon; the night scene and the Wazir seal. */
export function Crescent({
  size = 40,
  color = 'currentColor',
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg viewBox="-20 -20 40 40" width={size} height={size} className={className} aria-hidden>
      <path d="M6 -16 A16 16 0 1 0 6 16 A20 20 0 0 1 6 -16 Z" fill={color} />
    </svg>
  );
}

/**
 * Office seal: scalloped disc with the Ameer's star or the Wazir's crescent,
 * so the two offices differ by shape as well as color.
 */
export function OfficeSeal({
  office,
  size = 48,
  className,
}: {
  office: 'ameer' | 'wazir';
  size?: number;
  className?: string;
}) {
  const ameer = office === 'ameer';
  const field = ameer ? colors.gold : colors.emeraldLight;
  const rim = ameer ? colors.goldDark : colors.emerald;
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} className={className} aria-hidden>
      <polygon points={starPoints(16, 48, 42)} fill={field} stroke={rim} strokeWidth={3} />
      <circle r={34} fill="none" stroke={rim} strokeWidth={3} />
      {ameer ? (
        <polygon points={starPoints(8, 24, 24 * 0.7654)} fill={colors.ink} />
      ) : (
        <path d="M8 -24 A24 24 0 1 0 8 24 A30 30 0 0 1 8 -24 Z" fill={colors.ink} />
      )}
    </svg>
  );
}

/** Small record and badge glyphs. Geometric only: no figures. */
export function Glyph({
  name,
  size = 24,
  color = 'currentColor',
  className,
}: {
  name:
    | 'check'
    | 'cross'
    | 'burst'
    | 'key'
    | 'brokenSeal'
    | 'shuffle'
    | 'scales'
    | 'flag'
    | 'arrow'
    | 'ban';
  size?: number;
  color?: string;
  className?: string;
}) {
  const stroke = { fill: 'none', stroke: color, strokeWidth: 3, strokeLinecap: 'round' as const };
  const shape = {
    check: <path d="M-8 1 L-2 7 L9 -7" {...stroke} />,
    cross: <path d="M-7 -7 L7 7 M7 -7 L-7 7" {...stroke} />,
    burst: <polygon points={starPoints(10, 11, 4.5)} fill={color} />,
    key: (
      <g {...stroke} strokeWidth={2.5}>
        <circle cx={-5} cy={-5} r={4.5} />
        <path d="M-1.8 -1.8 L9 9 M5 5 L8 2 M7.5 7.5 L10 5" />
      </g>
    ),
    brokenSeal: (
      <g>
        <path d="M-1 -11 A11 11 0 0 0 -2 11 L1 4 L-3 0 L2 -5 Z" fill={color} />
        <path d="M3 -11 A11 11 0 0 1 4 11 L6 5 L2 1 L6 -5 Z" fill={color} />
      </g>
    ),
    shuffle: (
      <path
        d="M-10 -5 H-3 L4 5 H10 M-10 5 H-3 L4 -5 H10 M7 -8 L10 -5 L7 -2 M7 2 L10 5 L7 8"
        {...stroke}
        strokeWidth={2.2}
      />
    ),
    scales: (
      <g {...stroke} strokeWidth={2.2}>
        <path d="M0 -10 V10 M-6 10 H6 M-9 -6 H9 M-9 -6 L-12 2 H-6 Z M9 -6 L6 2 H12 Z" />
      </g>
    ),
    flag: <path d="M-7 10 V-10 M-7 -9 H8 L4 -4 L8 1 H-7" {...stroke} strokeWidth={2.4} />,
    arrow: <path d="M-9 0 H8 M3 -5 L8 0 L3 5" {...stroke} />,
    ban: (
      <g {...stroke} strokeWidth={2.4}>
        <circle r={9} />
        <path d="M-6 -6 L6 6" />
      </g>
    ),
  }[name];
  return (
    <svg viewBox="-12 -12 24 24" width={size} height={size} className={className} aria-hidden>
      {shape}
    </svg>
  );
}
