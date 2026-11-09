import { CARD_RATIO } from '../tokens';
import type { Scene } from './scene';

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

/** Columns a TV hand may span at full card size; wider hands scale their cards down. */
export const TV_MAX_COLS = 2.4;

/** The TV: seats on an ellipse around the deck and discard in the middle. */
export function tableLayout(
  width: number,
  height: number,
  playerIds: readonly string[],
): TableLayout {
  const n = Math.max(playerIds.length, 1);
  const pileW = Math.min(height * 0.2, width * 0.12);
  const sprite = Math.round(pileW);
  const cx = width / 2;
  const cy = height / 2;

  /** Seats around the ellipse for a given card width. */
  const place = (tableW: number) => {
    const gap = tableW * 0.1;
    const blockW = 2 * tableW + gap;
    const blockH = 2 * tableW * CARD_RATIO + gap;
    const label = Math.max(22, tableW * 0.42);
    const rx = width / 2 - blockW / 2 - width * 0.04;
    const ry = height / 2 - blockH / 2 - label - height * 0.03;
    const seats: SeatAnchor[] = playerIds.map((playerId, i) => {
      // Even tables turn half a seat so two seats sit on the long sides of a 16:9 screen.
      const offset = n % 2 === 0 && n >= 4 ? Math.PI / n : 0;
      const a = Math.PI / 2 + offset + (i * 2 * Math.PI) / n;
      const x = cx + rx * Math.cos(a);
      const y = cy + ry * Math.sin(a);
      const below = Math.sin(a) >= -0.01;
      return {
        playerId,
        x,
        y,
        labelX: x,
        labelY: y + (below ? 1 : -1) * (blockH / 2 + label * 0.75),
        cardWidth: tableW,
      };
    });
    // Two neighbors clear each other side by side (at the widest a hand grows) or one above the
    // other with room for a name plate between them.
    const widest = TV_MAX_COLS * (tableW + gap);
    const clear = seats.every((a, i) => {
      if (n < 2) return true;
      const b = seats[(i + 1) % n]!;
      return Math.abs(a.x - b.x) >= widest + gap * 2 || Math.abs(a.y - b.y) >= blockH + label * 1.6;
    });
    return { seats, gap, clear };
  };

  // The nominal size for the table, shrunk step by step until neighboring hands clear.
  let tableW = Math.min(height * (n <= 6 ? 0.095 : n <= 8 ? 0.085 : 0.072), width * 0.056);
  let placed = place(tableW);
  for (let i = 0; i < 24 && !placed.clear; i++) {
    tableW *= 0.95;
    placed = place(tableW);
  }
  const { seats, gap } = placed;
  const blockW = 2 * tableW + gap;
  const seatOf = (id: string) => seats.find((s) => s.playerId === id);

  return {
    width,
    height,
    spriteWidth: sprite,
    deck: { x: cx - pileW * 0.62, y: cy, scale: pileW / sprite, rotate: 0 },
    discard: { x: cx + pileW * 0.62, y: cy, scale: pileW / sprite, rotate: 0 },
    seats,
    slot(playerId, pos, cols) {
      const seat = seatOf(playerId);
      // Penalty columns widen a hand; its cards shrink so the hand stays about as wide as the
      // dealt 2×2 and never runs into a neighbor, even on a crowded 12-seat table.
      const cardW = tableW * Math.min(1, TV_MAX_COLS / cols);
      const cardGap = gap * (cardW / tableW);
      const w = cols * (cardW + cardGap);
      const margin = width * 0.012;
      const x = Math.min(Math.max(seat?.x ?? cx, margin + w / 2), width - margin - w / 2);
      return handPose(x, seat?.y ?? cy, cardW, cardGap, pos, cols, sprite);
    },
    drawn(playerId) {
      const seat = seatOf(playerId);
      const sx = seat?.x ?? cx;
      const sy = seat?.y ?? cy;
      // Beside the hand, on the side toward the middle of the table, clear of the piles.
      const side = cx - sx >= 0 ? 1 : -1;
      const drawnW = tableW * 1.2;
      const reach = blockW / 2 + drawnW / 2 + gap * 3;
      return { x: sx + side * reach, y: sy, scale: drawnW / sprite, rotate: side * -3 };
    },
    peek(rest, peekerId) {
      return peekToward(rest, seatOf(peekerId), tableW * CARD_RATIO * 0.45);
    },
  };
}

/** A rectangle in px within the layer. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
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
  scene.discard.forEach((c, i) => {
    const depth = scene.discard.length - 1 - i;
    out.set(c.cardId, {
      ...layout.discard,
      x: layout.discard.x + depth * 1.5,
      y: layout.discard.y + depth * 1.5,
      rotate: tossAngle(c.cardId),
    });
  });
  return out;
}
