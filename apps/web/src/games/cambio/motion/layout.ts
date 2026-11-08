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

/** Regions of the phone screen the DOM overlays line up with. All px within the layer. */
export interface PhoneRegions {
  /** The other players' strip: chips centered on each seat's label point. */
  strip: { bottom: number; chipW: number; chipH: number };
  /** The Cambio banner's center line, just under the strip. */
  bannerY: number;
  /** Your hand's box; cards and their hit targets live inside it. */
  hand: { top: number; bottom: number };
  /** Top of the action bar, the bottom third the thumb reaches. */
  actionTop: number;
  /** Width of one of your cards for a hand spanning `cols` columns. */
  handCardW(cols: number): number;
}

export interface PhoneLayout extends TableLayout {
  regions: PhoneRegions;
}

/** Chips per strip row: up to 6, so 11 others take two rows. */
export const STRIP_PER_ROW = 6;
const STRIP_TOP = 8;
const CHIP_H = 46;
const CHIP_GAP = 6;
const BANNER_H = 34;
/** Room the action bar keeps at the bottom: a 56 px primary button, a 48 px row, gaps. */
export const ACTION_H = 150;
const SIDE = 16;

/**
 * A phone in portrait, one-handed: the other players as a strip of chips along the top, the
 * deck and discard in the middle with your drawn card under them, your hand big above the
 * action bar. Other players' cards rest tucked under their chip, so cards still visibly fly to
 * and from them. Your cards shrink as penalty columns widen the hand, and grow back as it narrows.
 */
export function phoneLayout(
  width: number,
  height: number,
  playerIds: readonly string[],
  youId: string,
): PhoneLayout {
  const others = playerIds.filter((id) => id !== youId);
  const perRow = Math.min(Math.max(others.length, 1), STRIP_PER_ROW);
  const rows = Math.ceil(others.length / perRow);
  const cellW = (width - SIDE) / perRow;
  const chipW = Math.min(cellW - CHIP_GAP, 120);
  const stripBottom = STRIP_TOP + rows * (CHIP_H + CHIP_GAP);
  const bannerY = stripBottom + BANNER_H / 2;

  const actionTop = height - ACTION_H;
  const avail = Math.max(actionTop - stripBottom - BANNER_H, 200);
  const handBoxH = avail * 0.52;
  const handBottom = actionTop - 6;
  const handTop = handBottom - handBoxH;
  const gapFor = (w: number) => Math.max(6, w * 0.08);
  const maxHandW = Math.min(width * 0.27, (handBoxH - 12) / 2 / CARD_RATIO);
  const handCardW = (cols: number) => {
    const fit = (width - 2 * SIDE) / (cols + (cols - 1) * 0.08);
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
  const miniW = 9;

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
    const i = others.indexOf(playerId);
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, others.length - row * perRow);
    // A short last row is centered rather than left-aligned.
    const offset = ((perRow - inRow) * cellW) / 2;
    const x = SIDE / 2 + offset + cellW * ((i % perRow) + 0.5);
    const y = STRIP_TOP + row * (CHIP_H + CHIP_GAP) + CHIP_H / 2;
    return { playerId, x, y, labelX: x, labelY: y, cardWidth: chipW };
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
      strip: { bottom: stripBottom, chipW, chipH: CHIP_H },
      bannerY,
      hand: { top: handTop, bottom: handBottom },
      actionTop,
      handCardW,
    },
    slot(playerId, pos, cols) {
      const seat = seatOf(playerId);
      if (!seat) return { x: width / 2, y: pileY, scale: miniW / sprite, rotate: 0 };
      if (playerId === youId) {
        const w = handCardW(cols);
        return handPose(seat.x, seat.y, w, gapFor(w), pos, cols, sprite);
      }
      return handPose(seat.x, seat.y, miniW, 1, pos, cols, sprite);
    },
    drawn(playerId) {
      if (playerId === youId) return { x: width / 2, y: drawnY, scale: drawnW / sprite, rotate: 0 };
      const seat = seatOf(playerId);
      return {
        x: seat?.x ?? width / 2,
        y: seat?.y ?? 0,
        scale: (miniW * 1.4) / sprite,
        rotate: -3,
      };
    },
    peek(rest, peekerId) {
      // Your own card rises a little; anything else is peeked in the picker, so it stays put.
      if (peekerId === youId && rest.scale > (miniW * 2) / sprite) {
        return { ...rest, y: rest.y - rest.scale * sprite * 0.12, scale: rest.scale * 1.06 };
      }
      return rest;
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
