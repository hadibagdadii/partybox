import { BACK_INSET, CARD_RADIUS, CARD_VIEW, colors } from '../tokens';

const { w: W, h: H } = CARD_VIEW;
/** Concentric with the card's corner: inner radius = outer radius - inset. */
const INNER_R = CARD_RADIUS - BACK_INSET;
const FI = BACK_INSET + 7;

/**
 * Original back: a brass diamond lattice with rosettes, a framed field, and a center medallion.
 * Built once as an SVG image, so every face-down card shares one decoded bitmap: a deal of 48
 * cards mounts 48 plain divs instead of 48 SVG trees.
 */
const BACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
<defs>
<pattern id="l" width="30" height="30" patternUnits="userSpaceOnUse" x="${W / 2 - 15}" y="${H / 2 - 15}">
<path d="M0 15 15 0l15 15-15 15Z" fill="none" stroke="${colors.brass}" stroke-opacity=".55" stroke-width="1.3"/>
<path d="M15 8l7 7-7 7-7-7Z" fill="none" stroke="${colors.brass}" stroke-opacity=".3" stroke-width="1"/>
<circle cx="15" cy="15" r="2.2" fill="${colors.brassLight}" fill-opacity=".8"/>
${[
  [0, 0],
  [30, 0],
  [0, 30],
  [30, 30],
]
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="${colors.brass}" fill-opacity=".7"/>`)
  .join('')}
</pattern>
<clipPath id="c"><rect x="${FI}" y="${FI}" width="${W - FI * 2}" height="${H - FI * 2}" rx="${Math.max(INNER_R - 7, 2)}"/></clipPath>
</defs>
<rect width="${W}" height="${H}" rx="${CARD_RADIUS}" fill="${colors.backField}"/>
<rect x="${BACK_INSET}" y="${BACK_INSET}" width="${W - BACK_INSET * 2}" height="${H - BACK_INSET * 2}" rx="${INNER_R}" fill="${colors.backFieldDeep}" stroke="${colors.brass}" stroke-width="2"/>
<rect x="${FI}" y="${FI}" width="${W - FI * 2}" height="${H - FI * 2}" fill="url(#l)" clip-path="url(#c)"/>
<path d="M125 112 172 175 125 238 78 175Z" fill="${colors.backFieldDeep}" stroke="${colors.brass}" stroke-width="2.5"/>
<path d="M125 132 157 175 125 218 93 175Z" fill="none" stroke="${colors.brassLight}" stroke-width="1.5"/>
<circle cx="125" cy="175" r="12" fill="${colors.brass}"/>
<circle cx="125" cy="175" r="5" fill="${colors.backFieldDeep}"/>
<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="${CARD_RADIUS}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1.5"/>
</svg>`;

export const BACK_IMAGE = `url("data:image/svg+xml,${encodeURIComponent(BACK_SVG)}")`;

export function CardBack() {
  return (
    <div
      aria-hidden="true"
      data-back=""
      style={{
        width: '100%',
        height: '100%',
        backgroundImage: BACK_IMAGE,
        backgroundSize: '100% 100%',
      }}
    />
  );
}
