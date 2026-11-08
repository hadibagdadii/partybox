import { cardValue, theme, type Face, type Suit } from '@partybox/cambio';
import { CARD_RADIUS, CARD_VIEW, colors, fonts } from '../tokens';
import { CourtArt } from './CourtFace';
import { MIDLINE, PIP_LAYOUTS, PIP_SIZE } from './pips';
import { Pip, Star, isRedSuit } from './suits';

const FONT = fonts.card.join(', ');

/** Ink for a face: red suits red, black suits and Jokers ink. */
export const inkOf = (face: Face) => (isRedSuit(face.suit) ? colors.red : colors.ink);

/** The special value a badge calls out: -1 for red Kings, 0 for Jokers. Null otherwise. */
export function badgeValue(face: Face): number | null {
  const v = cardValue(face);
  return face.rank === 'joker' || (face.rank === 'K' && v < 0) ? v : null;
}

/** One corner index: rank above suit, drawn expanded and heavy to read across a room. */
function Index({ face, ink }: { face: Face; ink: string }) {
  const short = theme.ranks[face.rank].short;
  const narrow = short.length > 1;
  return (
    <g>
      <text
        x={31}
        y={58}
        textAnchor="middle"
        fill={ink}
        fontFamily={FONT}
        fontWeight={800}
        fontSize={narrow ? 44 : 54}
        style={{ fontStretch: narrow ? '75%' : '112%' }}
        letterSpacing={narrow ? -2 : 0}
        data-part="rank"
      >
        {short}
      </text>
      {face.suit ? (
        <Pip suit={face.suit} x={31} y={84} size={30} fill={ink} />
      ) : (
        <Star x={31} y={84} r={15} fill={ink} />
      )}
    </g>
  );
}

function Badge({ value }: { value: number }) {
  return (
    <g data-part="badge">
      <circle cx={214} cy={36} r={23} fill={value < 0 ? colors.badgeMinus : colors.badgeZero} />
      <circle
        cx={214}
        cy={36}
        r={19.5}
        fill="none"
        stroke="rgba(255,255,255,.55)"
        strokeWidth={1.5}
      />
      <text
        x={214}
        y={45}
        textAnchor="middle"
        fill="#fff"
        fontFamily={FONT}
        fontWeight={800}
        fontSize={25}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value < 0 ? `−${Math.abs(value)}` : value}
      </text>
    </g>
  );
}

function Pips({ suit, rank }: { suit: Suit; rank: Face['rank'] }) {
  const ink = isRedSuit(suit) ? colors.red : colors.ink;
  if (rank === 'A') {
    return (
      <g>
        <circle
          cx={125}
          cy={175}
          r={70}
          fill="none"
          stroke={ink}
          strokeOpacity={0.14}
          strokeWidth={2}
        />
        <Pip suit={suit} x={125} y={175} size={104} fill={ink} />
      </g>
    );
  }
  const layout = PIP_LAYOUTS[rank] ?? [];
  return (
    <g>
      {layout.map(([x, y], i) => (
        <Pip key={i} suit={suit} x={x} y={y} size={PIP_SIZE} flip={y > MIDLINE} fill={ink} />
      ))}
    </g>
  );
}

function JokerArt() {
  return (
    <g>
      <circle
        cx={125}
        cy={168}
        r={78}
        fill="none"
        stroke={colors.ink}
        strokeOpacity={0.18}
        strokeWidth={2}
      />
      <circle cx={125} cy={168} r={64} fill="none" stroke={colors.red} strokeWidth={3} />
      <g transform="rotate(22.5 125 168)">
        <Star x={125} y={168} r={58} fill={colors.ink} />
      </g>
      <Star x={125} y={168} r={46} fill={colors.red} />
      <circle cx={125} cy={168} r={11} fill={colors.stock} />
      <text
        x={125}
        y={286}
        textAnchor="middle"
        fill={colors.ink}
        fontFamily={FONT}
        fontWeight={700}
        fontSize={30}
        style={{ fontStretch: '112%' }}
        letterSpacing={2}
      >
        {theme.ranks.joker.name}
      </text>
    </g>
  );
}

/** A card's printed side as SVG: our own pips, court designs, and Joker. */
export function CardFace({ face }: { face: Face }) {
  const ink = inkOf(face);
  const badge = badgeValue(face);
  const court = face.rank === 'J' || face.rank === 'Q' || face.rank === 'K';
  return (
    <svg
      viewBox={`0 0 ${CARD_VIEW.w} ${CARD_VIEW.h}`}
      width="100%"
      height="100%"
      aria-hidden="true"
      data-face={`${face.rank}-${face.suit ?? 'none'}`}
    >
      <rect
        x={0.75}
        y={0.75}
        width={CARD_VIEW.w - 1.5}
        height={CARD_VIEW.h - 1.5}
        rx={CARD_RADIUS}
        fill={colors.stock}
        stroke="rgba(0,0,0,.12)"
        strokeWidth={1.5}
      />
      <Index face={face} ink={ink} />
      <g transform={`rotate(180 ${CARD_VIEW.w / 2} ${CARD_VIEW.h / 2})`}>
        <Index face={face} ink={ink} />
      </g>
      {face.rank === 'joker' || !face.suit ? (
        <JokerArt />
      ) : court ? (
        <CourtArt rank={face.rank as 'J' | 'Q' | 'K'} suit={face.suit} />
      ) : (
        <Pips suit={face.suit} rank={face.rank} />
      )}
      {badge !== null && <Badge value={badge} />}
    </svg>
  );
}
