import { theme, type Suit } from '@partybox/cambio';
import { useId } from 'react';
import { colors, fonts } from '../tokens';
import { Pip, isRedSuit } from './suits';

const FONT = fonts.card.join(', ');

/** Each court rank's emblem, built from simple geometry above the letter. */
function Emblem({ rank, ink, suit }: { rank: 'J' | 'Q' | 'K'; ink: string; suit: Suit }) {
  switch (rank) {
    case 'K':
      return (
        <g>
          <path d="M92 108 96 76l15 15 14-23 14 23 15-15 4 32Z" fill={ink} />
          <rect x={92} y={110} width={66} height={6} rx={2} fill={ink} />
          {[96, 125, 154].map((x, i) => (
            <circle key={x} cx={x} cy={i === 1 ? 66 : 74} r={4.5} fill={ink} />
          ))}
          <Pip suit={suit} x={125} y={97} size={13} fill={colors.stock} />
        </g>
      );
    case 'Q':
      return (
        <g>
          <path
            d="M90 112q35-22 70 0"
            fill="none"
            stroke={ink}
            strokeWidth={6}
            strokeLinecap="round"
          />
          {[
            [94, 98],
            [109, 86],
            [125, 81],
            [141, 86],
            [156, 98],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i === 2 ? 7 : 5} fill={ink} />
          ))}
          <Pip suit={suit} x={125} y={66} size={20} fill={ink} />
        </g>
      );
    case 'J':
      return (
        <g>
          <path d="M80 96 125 80l45 16-45 16Z" fill={ink} />
          <path d="M98 96 125 87l27 9-27 9Z" fill={colors.stock} />
          <Pip suit={suit} x={125} y={96} size={14} fill={ink} />
        </g>
      );
  }
}

/** J, Q, K: a framed court panel with emblem and letter, mirrored top and bottom. */
export function CourtArt({ rank, suit }: { rank: 'J' | 'Q' | 'K'; suit: Suit }) {
  const ink = isRedSuit(suit) ? colors.red : colors.ink;
  const tint = isRedSuit(suit) ? '#f6e1df' : '#e3e6ec';
  const clip = useId();
  const half = (
    <g>
      <Emblem rank={rank} ink={ink} suit={suit} />
      <text
        x={125}
        y={168}
        textAnchor="middle"
        fill={ink}
        fontFamily={FONT}
        fontWeight={900}
        fontSize={62}
        style={{ fontStretch: '125%' }}
      >
        {theme.ranks[rank].short}
      </text>
    </g>
  );
  return (
    <g>
      <clipPath id={clip}>
        <rect x={56} y={56} width={138} height={238} rx={9} />
      </clipPath>
      <rect x={56} y={56} width={138} height={238} rx={9} fill={tint} />
      <g clipPath={`url(#${clip})`}>
        {/* Fine diagonal hatching gives the panel a printed texture. */}
        {Array.from({ length: 22 }, (_, i) => (
          <line
            key={i}
            x1={56 + i * 14 - 120}
            y1={294}
            x2={56 + i * 14}
            y2={56}
            stroke={ink}
            strokeOpacity={0.07}
            strokeWidth={2}
          />
        ))}
      </g>
      <rect
        x={56}
        y={56}
        width={138}
        height={238}
        rx={9}
        fill="none"
        stroke={ink}
        strokeWidth={2.5}
      />
      <line
        x1={70}
        y1={175}
        x2={180}
        y2={175}
        stroke={ink}
        strokeOpacity={0.35}
        strokeWidth={1.5}
      />
      {half}
      <g transform="rotate(180 125 175)">{half}</g>
    </g>
  );
}
