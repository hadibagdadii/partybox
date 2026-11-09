import { CARD_RATIO } from '../tokens';
import { DISCARD_KEEP, type Scene } from './scene';

/** A card's resting transform. x/y are the card's center in px within the layer. */
export interface Pose {
  x: number;
  y: number;
  /** Card width over the layer's sprite width. */
  scale: number;
  rotate: number;
  rotateX?: number;
  rotateY?: number;
}

export interface SeatAnchor {
  playerId: string;
  x: number;
  y: number;
  /** Where the name plate sits, outside the hand. */
  labelX: number;
  labelY: number;
  /** Width of the seat's card in px, for sizing the name plate. */
  cardWidth: number;
}

/** Card geometry for one screen. Pure: the same size and seats always give the same poses. */
export interface TableLayout {
  width: number;
  height: number;
  /** Width every card sprite is drawn at; zones scale it down with `Pose.scale`. */
  spriteWidth: number;
  deck: Pose;
  discard: Pose;
  seats: SeatAnchor[];
  /** Resting pose of grid position `pos` in a hand spanning `cols` columns. */
  slot(playerId: string, pos: number, cols: number): Pose;
  drawn(playerId: string): Pose;
  /** The peeked card, raised and tilted toward the peeker. */
  peek(rest: Pose, peekerId: string): Pose;
}

/** Grid cell for position `pos`: the dealt 2×2 first, further cards in new columns to the right. */
export function gridCell(pos: number): { col: number; row: number } {
  if (pos < 4) return { col: pos % 2, row: Math.floor(pos / 2) };
  return { col: 2 + Math.floor((pos - 4) / 2), row: (pos - 4) % 2 };
}

/**
 * Columns a hand's grid spans: up to its highest occupied position. Holes inside the grid stay
 * open, so the grid only narrows once its last column is empty, and never below the dealt 2×2.
 */
export function handCols(positions: readonly number[]): number {
  const top = positions.length ? Math.max(...positions) : 0;
  return Math.max(2, gridCell(top).col + 1);
}

/** Small stable tilt for discard cards, so the pile looks tossed rather than stacked. */
export function tossAngle(cardId: string): number {
  let h = 0;
  for (let i = 0; i < cardId.length; i++) h = (h * 31 + cardId.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 9) - 4) * 1.1;
}

function handPose(
  cx: number,
  cy: number,
  w: number,
  gap: number,
  pos: number,
  cols: number,
  sprite: number,
): Pose {
  const { col, row } = gridCell(pos);
  const h = w * CARD_RATIO;
  return {
    x: cx + (col - (cols - 1) / 2) * (w + gap),
    y: cy + (row - 0.5) * (h + gap),
    scale: w / sprite,
    rotate: 0,
  };
}

function peekToward(rest: Pose, seat: SeatAnchor | undefined, lift: number): Pose {
  const dx = seat ? seat.x - rest.x : 0;
  const dy = seat ? seat.y - rest.y : 1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x: rest.x + ux * lift * 0.4,
    y: rest.y - lift + uy * lift * 0.4,
    scale: rest.scale * 1.18,
    rotate: ux * 4,
    // Tip the face toward the peeker: the far edge rises.
    rotateX: -uy * 24,
    rotateY: ux * 24,
  };
}

/** A rectangle in px within the layer. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Columns a TV hand may span at full card size; wider hands scale their cards down. */
export const TV_MAX_COLS = 2.4;

/** Does `a` overlap `b`, with `pad` px kept between them? */
export const boxesOverlap = (a: Box, b: Box, pad = 0): boolean =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/** A TV seat: its hand, and the name plate on the outer side of the table. */
export interface TvSeat extends SeatAnchor {
  /** The plate sits above the hand on the top half of the table, below it otherwise. */
  plateSide: 'above' | 'below';
  plateW: number;
  plateH: number;
  /** The hand at its widest plus the plate: nothing else may enter it. */
  box: Box;
}

export interface TvLayout extends TableLayout {
  seats: TvSeat[];
  /** The deck, the discard and room for the callouts over them. */
  pileBox: Box;
  /** The felt oval the hands sit on. */
  felt: { cx: number; cy: number; rx: number; ry: number };
  /** Bars along the top and bottom edges kept free for the room code, banner, and ticker. */
  bands: { top: number; bottom: number };
  /** The card width hands use at the dealt size. */
  cardW: number;
}

/** Share of the height kept free at the top and bottom edges. */
const TOP_BAND = 0.075;
const BOTTOM_BAND = 0.07;

/**
 * Points on an ellipse at equal distances along its edge, starting at the bottom center and
 * going clockwise on screen (bottom, left, top, right). Equal arc length rather than equal
 * angle keeps a wide table's seats evenly spread instead of bunched at the ends.
 */
export function ellipseSeats(
  n: number,
  rx: number,
  ry: number,
  offset: number,
): { x: number; y: number; angle: number }[] {
  const steps = 2048;
  const lens: number[] = [0];
  const at = (t: number) => ({ x: rx * Math.cos(t), y: ry * Math.sin(t) });
  for (let i = 1; i <= steps; i++) {
    const a = at(Math.PI / 2 + ((i - 1) * 2 * Math.PI) / steps);
    const b = at(Math.PI / 2 + (i * 2 * Math.PI) / steps);
    lens.push(lens[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = lens[steps]!;
  return Array.from({ length: n }, (_, i) => {
    const want = (((i + offset) / n) % 1) * total;
    let lo = 0;
    let hi = steps;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (lens[mid]! <= want) lo = mid;
      else hi = mid;
    }
    const frac = (want - lens[lo]!) / (lens[lo + 1]! - lens[lo]! || 1);
    const angle = Math.PI / 2 + ((lo + frac) * 2 * Math.PI) / steps;
    const p = at(angle);
    // Snap tiny float noise so mirrored seats compare equal.
    const round = (v: number) => Math.round(v * 1000) / 1000;
    return { x: round(p.x), y: round(p.y), angle };
  });
}

/** Nominal card width for a table of `n`, as a share of the height. */
const nominalCard = (n: number) =>
  n <= 3 ? 0.12 : n <= 4 ? 0.11 : n <= 6 ? 0.1 : n <= 8 ? 0.088 : n <= 10 ? 0.078 : 0.07;

/**
 * The TV: a felt oval with seats around its edge and the deck and discard big in the middle.
 * Seats are spread at equal distances along the oval, starting bottom center (odd tables) or
 * straddling it (even tables), so every table is mirror-symmetric. Cards start at a nominal
 * size for the table and shrink until no seat (its widest hand plus its name plate) touches
 * another seat, the piles, or the bars along the top and bottom edges. Pure.
 */
export function tableLayout(width: number, height: number, playerIds: readonly string[]): TvLayout {
  const n = Math.max(playerIds.length, 1);
  const top = Math.round(height * TOP_BAND);
  const bottom = Math.round(height * BOTTOM_BAND);
  const playTop = top;
  const playBottom = height - bottom;
  const cx = width / 2;
  const cy = (playTop + playBottom) / 2;
  const margin = width * 0.012;

  // Big in the middle; a little smaller on crowded tables, which need the height for seats.
  const pileW = Math.min(height * (n <= 2 ? 0.2 : n <= 8 ? 0.175 : 0.16), width * 0.115);
  const pileH = pileW * CARD_RATIO;
  const pileBox: Box = {
    x: cx - pileW * 1.2,
    y: cy - pileH * 0.54,
    w: pileW * 2.4,
    h: pileH * 1.08,
  };
  const sprite = Math.round(pileW);
  /**
   * Which side of the hand the drawn card sits on. Seats at the ends of the table hold it toward
   * the middle; along the long sides it follows the turn order around the table (right on the
   * bottom row, left on the top), so two neighbors never both reserve the gap between them.
   */
  const drawnSide = (x: number, y: number, rx: number): 1 | -1 => {
    if (Math.abs(x - cx) > rx * 0.82) return x > cx ? -1 : 1;
    return y >= cy ? 1 : -1;
  };

  const place = (cardW: number) => {
    const gap = cardW * 0.1;
    const handW = TV_MAX_COLS * (cardW + gap);
    const handH = 2 * cardW * CARD_RATIO + gap;
    // Names stay readable from across a room even when the cards get small.
    const plateH = Math.max(height * 0.037, cardW * 0.5);
    const plateW = Math.max(handW, cardW * 2.7);
    // Room beside the hand, on the side toward the middle, for the card its player draws.
    // The held card tucks a little over the hand's edge, lifted above it.
    const drawnRoom = gap + cardW * 1.15 * 0.8;
    const boxW = Math.max(handW / 2, plateW / 2) + Math.max(handW / 2 + drawnRoom, plateW / 2);
    const boxH = handH + plateH + gap;
    const rx = width / 2 - margin - boxW / 2;
    const ry = (playBottom - playTop) / 2 - handH / 2 - plateH - gap * 1.5;
    // Two players face each other across the piles; even tables straddle the bottom center.
    const offset = n % 2 === 0 ? 0.5 : 0;
    const spots = ellipseSeats(n, rx, ry, offset);
    const seats: TvSeat[] = playerIds.map((playerId, i) => {
      const spot = spots[i]!;
      const x = cx + spot.x;
      const y = cy + spot.y;
      const plateSide = spot.y < -0.01 ? 'above' : 'below';
      const labelY =
        plateSide === 'above' ? y - handH / 2 - gap - plateH / 2 : y + handH / 2 + gap + plateH / 2;
      const boxTop = plateSide === 'above' ? y - handH / 2 - gap - plateH : y - handH / 2;
      const inward = drawnSide(x, y, rx);
      const near = Math.max(handW / 2, plateW / 2);
      const boxX = inward > 0 ? x - near : x - (boxW - near);
      return {
        playerId,
        x,
        y,
        labelX: x,
        labelY,
        cardWidth: cardW,
        plateSide,
        plateW,
        plateH,
        box: { x: boxX, y: boxTop, w: boxW, h: boxH },
      };
    });
    const pad = gap;
    const clear = seats.every((a, i) => {
      const b = a.box;
      if (b.x < margin - 0.5 || b.x + b.w > width - margin + 0.5) return false;
      if (b.y < playTop - 0.5 || b.y + b.h > playBottom + 0.5) return false;
      if (boxesOverlap(b, pileBox, pad)) return false;
      return seats.every((o, j) => j <= i || !boxesOverlap(b, o.box, pad));
    });
    return { seats, gap, clear, rx, ry, handH };
  };

  let cardW = Math.min(height * nominalCard(n), width * 0.062);
  let placed = place(cardW);
  for (let i = 0; i < 30 && !placed.clear; i++) {
    cardW *= 0.95;
    placed = place(cardW);
  }
  const { seats, gap, rx, ry, handH } = placed;
  const seatOf = (id: string) => seats.find((s) => s.playerId === id);
  // Big enough to hold every hand, and inside the edge bars with room for the rail around it.
  const rail = Math.max(14, height * 0.022);
  const felt = {
    cx,
    cy,
    rx: Math.min(rx + cardW * 1.3, width / 2 - rail - margin),
    ry: Math.min(ry + handH * 0.75, (playBottom - playTop) / 2 - rail),
  };

  return {
    width,
    height,
    spriteWidth: sprite,
    deck: { x: cx - pileW * 0.62, y: cy, scale: pileW / sprite, rotate: 0 },
    discard: { x: cx + pileW * 0.62, y: cy, scale: pileW / sprite, rotate: 0 },
    seats,
    pileBox,
    felt,
    bands: { top, bottom },
    cardW,
    slot(playerId, pos, cols) {
      const seat = seatOf(playerId);
      // Penalty columns widen a hand; its cards shrink so the hand stays about as wide as the
      // dealt 2×2 and never runs into a neighbor, even on a crowded 12-seat table.
      const w = cardW * Math.min(1, TV_MAX_COLS / cols);
      return handPose(seat?.x ?? cx, seat?.y ?? cy, w, gap * (w / cardW), pos, cols, sprite);
    },
    drawn(playerId) {
      const seat = seatOf(playerId);
      const sx = seat?.x ?? cx;
      const sy = seat?.y ?? cy;
      const drawnW = cardW * 1.15;
      const side = drawnSide(sx, sy, rx);
      const handW = TV_MAX_COLS * (cardW + gap);
      return {
        x: sx + side * (handW / 2 + gap + drawnW * 0.3),
        y: sy,
        scale: drawnW / sprite,
        rotate: side * -4,
      };
    },
    peek(rest, peekerId) {
      return peekToward(rest, seatOf(peekerId), cardW * CARD_RATIO * 0.45);
    },
  };
}

/** One other player's mini hand on the phone: the whole box, its name line, and its cards. */
export interface MiniHandBox extends Box {
  playerId: string;
  /** Top of the cards, under the name line. */
  cardsTop: number;
  row: number;
}

/** Regions of the phone screen the DOM overlays line up with. All px within the layer. */
export interface PhoneRegions {
  /** The other players' mini hands along the top. */
  strip: { bottom: number; rows: number; miniW: number; hands: MiniHandBox[] };
  /** The Cambio banner's center line, just under the strip. */
  bannerY: number;
  /** Your hand's box; cards and their hit targets live inside it. */
  hand: { top: number; bottom: number };
  /** Top of the action bar, the bottom third the thumb reaches. */
  actionTop: number;
  /** Width of one of your cards for a hand spanning `cols` columns. */
  handCardW(cols: number): number;
  /** Width of the drawn card under the piles. */
  drawnW: number;
}

export interface PhoneLayout extends TableLayout {
  regions: PhoneRegions;
}

/** Mini hands per strip row: up to 6, so 7 to 11 others take two rows. */
export const STRIP_PER_ROW = 6;
/** Mini cards never shrink below this; a crowded strip takes another row instead. */
export const MINI_MIN = 18;
/** Mini cards never grow past this, so your own hand stays the biggest thing on screen. */
export const MINI_MAX = 34;
const MAX_ROWS = 3;
const STRIP_TOP = 6;
const STRIP_SIDE = 8;
const HAND_GAP = 6;
const ROW_GAP = 4;
/** Padding inside a mini hand's box, room for the turn ring. */
export const MINI_PAD = 3;
/** The name line above a mini hand's cards. */
export const NAME_H = 16;
const BANNER_H = 34;
/** Room the action bar keeps at the bottom: a 56 px primary button, a 48 px row, gaps. */
export const ACTION_H = 150;
const SIDE = 16;

const miniGap = (w: number) => Math.max(2, w * 0.08);
/** Width of a mini hand's box for `cols` columns of cards `w` wide. */
const miniBoxW = (cols: number, w: number) => cols * w + (cols - 1) * miniGap(w) + 2 * MINI_PAD;

/** Splits `others` into `rows` rows, as even as possible, longer rows first. */
function splitRows<T>(others: readonly T[], rows: number): T[][] {
  const out: T[][] = [];
  const per = Math.ceil(others.length / rows);
  for (let i = 0; i < others.length; i += per) out.push(others.slice(i, i + per));
  return out;
}

/** Width a row of mini hands spans, gutters included, with cards `w` wide. */
const rowW = (row: readonly string[], w: number, cols: (id: string) => number) =>
  row.reduce((n, id) => n + miniBoxW(cols(id), w), 0) +
  (row.length - 1) * HAND_GAP +
  2 * STRIP_SIDE;

/** Share of the screen height the strip may take before mini cards shrink to protect your hand. */
const STRIP_SHARE = 0.3;

/**
 * The biggest mini card width, in quarter px, at which every row fits across the screen and
 * the strip stays within its share of the height. Never below `MINI_MIN` for height alone.
 */
function fitMini(
  width: number,
  height: number,
  rows: string[][],
  cols: (id: string) => number,
): number {
  const perRow = (height * STRIP_SHARE - STRIP_TOP) / Math.max(rows.length, 1);
  const tall = (perRow - NAME_H - MINI_PAD - ROW_GAP) / (2 * CARD_RATIO + 0.08);
  let w = Math.min(MINI_MAX, Math.max(MINI_MIN, Math.floor(tall * 4) / 4));
  while (w > 1 && rows.some((row) => rowW(row, w, cols) > width)) w -= 0.25;
  return w;
}

/**
 * A phone in portrait, one-handed: the other players as mini hands along the top, each card
 * face down on its stable grid position with holes kept open; the deck and discard in the
 * middle with your drawn card under them; your hand big above the action bar. Every mini card
 * is one size; a hand that grows a penalty column takes a wider share of its row instead of
 * shrinking. Up to 6 others fit one row, 7 to 11 take two, and a third row only appears if
 * penalty columns would push the cards under `MINI_MIN`.
 *
 * `cols` gives each hand's current column count (from the scene); missing hands count as 2.
 */
export function phoneLayout(
  width: number,
  height: number,
  playerIds: readonly string[],
  youId: string,
  cols: Readonly<Record<string, number>> = {},
): PhoneLayout {
  const others = playerIds.filter((id) => id !== youId);
  const colsOf = (id: string) => Math.max(2, cols[id] ?? 2);

  let nRows = Math.max(1, Math.ceil(others.length / STRIP_PER_ROW));
  let rows = splitRows(others, nRows);
  let miniW = fitMini(width, height, rows, colsOf);
  while (miniW < MINI_MIN && nRows < Math.min(MAX_ROWS, others.length)) {
    nRows += 1;
    rows = splitRows(others, nRows);
    miniW = fitMini(width, height, rows, colsOf);
  }
  if (!others.length) rows = [];
  const miniH = miniW * CARD_RATIO;
  const mGap = miniGap(miniW);
  const boxH = NAME_H + 2 * miniH + mGap + MINI_PAD;

  const hands: MiniHandBox[] = [];
  rows.forEach((row, r) => {
    const total =
      row.reduce((n, id) => n + miniBoxW(colsOf(id), miniW), 0) + (row.length - 1) * HAND_GAP;
    // Each row is centered, so a short last row sits in the middle.
    let x = (width - total) / 2;
    const y = STRIP_TOP + r * (boxH + ROW_GAP);
    for (const id of row) {
      const w = miniBoxW(colsOf(id), miniW);
      hands.push({ playerId: id, x, y, w, h: boxH, cardsTop: y + NAME_H, row: r });
      x += w + HAND_GAP;
    }
  });
  const stripBottom = rows.length ? STRIP_TOP + rows.length * (boxH + ROW_GAP) : STRIP_TOP;
  const bannerY = stripBottom + BANNER_H / 2;

  const actionTop = height - ACTION_H;
  const avail = Math.max(actionTop - stripBottom - BANNER_H, 200);
  const handBoxH = avail * 0.52;
  const handBottom = actionTop - 6;
  const handTop = handBottom - handBoxH;
  const gapFor = (w: number) => Math.max(6, w * 0.08);
  const maxHandW = Math.min(width * 0.27, (handBoxH - 12) / 2 / CARD_RATIO);
  const handCardW = (c: number) => {
    const fit = (width - 2 * SIDE) / (c + (c - 1) * 0.08);
    return Math.min(maxHandW, fit);
  };
  const handCy = (handTop + handBottom) / 2;

  const midTop = stripBottom + BANNER_H;
  const midH = handTop - midTop;
  const pileW = Math.min(width * 0.2, (midH * 0.42) / CARD_RATIO);
  const pileH = pileW * CARD_RATIO;
  const pileY = midTop + pileH / 2 + 4;
  const drawnW = Math.min(maxHandW * 0.95, Math.max(40, (midH - pileH - 20) / CARD_RATIO));
  const drawnY = Math.min(
    handTop - (drawnW * CARD_RATIO) / 2 - 4,
    pileY + pileH / 2 + 12 + (drawnW * CARD_RATIO) / 2,
  );
  const sprite = Math.round(Math.max(maxHandW, pileW));

  const handOf = (id: string) => hands.find((h) => h.playerId === id);
  const seats: SeatAnchor[] = playerIds.map((playerId) => {
    if (playerId === youId) {
      return {
        playerId,
        x: width / 2,
        y: handCy,
        labelX: width / 2,
        labelY: handBottom,
        cardWidth: maxHandW,
      };
    }
    const b = handOf(playerId);
    const x = b ? b.x + b.w / 2 : width / 2;
    const y = b ? b.cardsTop + miniH + mGap / 2 : STRIP_TOP;
    return { playerId, x, y, labelX: x, labelY: b ? b.y + NAME_H / 2 : y, cardWidth: miniW };
  });
  const seatOf = (id: string) => seats.find((s) => s.playerId === id);

  return {
    width,
    height,
    spriteWidth: sprite,
    deck: { x: width / 2 - pileW * 0.62, y: pileY, scale: pileW / sprite, rotate: 0 },
    discard: { x: width / 2 + pileW * 0.62, y: pileY, scale: pileW / sprite, rotate: 0 },
    seats,
    regions: {
      strip: { bottom: stripBottom, rows: rows.length, miniW, hands },
      bannerY,
      hand: { top: handTop, bottom: handBottom },
      actionTop,
      handCardW,
      drawnW,
    },
    slot(playerId, pos, c) {
      const seat = seatOf(playerId);
      if (!seat) return { x: width / 2, y: pileY, scale: miniW / sprite, rotate: 0 };
      if (playerId === youId) {
        const w = handCardW(c);
        return handPose(seat.x, seat.y, w, gapFor(w), pos, c, sprite);
      }
      return handPose(seat.x, seat.y, miniW, mGap, pos, c, sprite);
    },
    drawn(playerId) {
      if (playerId === youId) return { x: width / 2, y: drawnY, scale: drawnW / sprite, rotate: 0 };
      const b = handOf(playerId);
      const w = miniW * 1.25;
      // Held just under their hand, lifted over its bottom edge: it reads as in their hand.
      return {
        x: b ? b.x + b.w / 2 : width / 2,
        y: b ? b.y + b.h + w * CARD_RATIO * 0.1 : 0,
        scale: w / sprite,
        rotate: -4,
      };
    },
    peek(rest, peekerId) {
      const target = rest.scale * sprite;
      // You peeking at your own card: it rises a little, the face is for you.
      if (peekerId === youId && target > miniW * 2) {
        return { ...rest, y: rest.y - target * 0.12, scale: rest.scale * 1.06 };
      }
      // Anything else lifts and tilts toward whoever is looking, big enough to see at a glance.
      const p = peekToward(rest, seatOf(peekerId), target * CARD_RATIO * 0.35);
      return { ...p, scale: rest.scale * (target > miniW * 2 ? 1.12 : 1.4) };
    },
  };
}

/** Every card's resting pose in a scene, by card id. */
export function posesFor(scene: Scene, layout: TableLayout): Map<string, Pose> {
  const out = new Map<string, Pose>();
  for (const seat of scene.seats) {
    const cols = handCols(seat.slots.map((x) => x.pos));
    seat.slots.forEach((slot) => {
      let pose = layout.slot(seat.playerId, slot.pos, cols);
      if (scene.peek && scene.peek.slotId === slot.slotId)
        pose = layout.peek(pose, scene.peek.playerId);
      out.set(slot.cardId, pose);
    });
  }
  if (scene.drawn) out.set(scene.drawn.cardId, layout.drawn(scene.drawn.playerId));
  // Chained snaps fan out across the pile, so a stack of them reads at a glance.
  const fan = scene.discardChain > 0 ? Math.min(scene.discardChain + 1, DISCARD_KEEP) : 0;
  const cardW = layout.spriteWidth * layout.discard.scale;
  scene.discard.forEach((c, i) => {
    const depth = scene.discard.length - 1 - i;
    const fanned = depth < fan;
    out.set(c.cardId, {
      ...layout.discard,
      x: layout.discard.x + (fanned ? -depth * cardW * 0.14 : depth * 1.5),
      y: layout.discard.y + (fanned ? depth * cardW * 0.03 : depth * 1.5),
      rotate: tossAngle(c.cardId) + (fanned ? -depth * 7 : 0),
    });
  });
  return out;
}
