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
  slot(playerId: string, index: number, count: number): Pose;
  drawn(playerId: string): Pose;
  /** The peeked card, raised and tilted toward the peeker. */
  peek(rest: Pose, peekerId: string): Pose;
}

/** Grid cell for slot `index`: the dealt 2×2 first, penalty cards in new columns to the right. */
export function gridCell(index: number): { col: number; row: number } {
  if (index < 4) return { col: index % 2, row: Math.floor(index / 2) };
  return { col: 2 + Math.floor((index - 4) / 2), row: (index - 4) % 2 };
}

const colsFor = (count: number) => (count <= 4 ? 2 : 2 + Math.ceil((count - 4) / 2));

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
  index: number,
  count: number,
  sprite: number,
): Pose {
  const { col, row } = gridCell(index);
  const cols = colsFor(count);
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

/** The TV: seats on an ellipse around the deck and discard in the middle. */
export function tableLayout(
  width: number,
  height: number,
  playerIds: readonly string[],
): TableLayout {
  const n = Math.max(playerIds.length, 1);
  const tableW = Math.min(height * (n <= 6 ? 0.095 : n <= 8 ? 0.085 : 0.072), width * 0.056);
  const gap = tableW * 0.1;
  const pileW = Math.min(height * 0.2, width * 0.12);
  const sprite = Math.round(pileW);
  const cx = width / 2;
  const cy = height / 2;
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
  const seatOf = (id: string) => seats.find((s) => s.playerId === id);

  return {
    width,
    height,
    spriteWidth: sprite,
    deck: { x: cx - pileW * 0.62, y: cy, scale: pileW / sprite, rotate: 0 },
    discard: { x: cx + pileW * 0.62, y: cy, scale: pileW / sprite, rotate: 0 },
    seats,
    slot(playerId, index, count) {
      const seat = seatOf(playerId);
      // Penalty columns widen a hand; keep the whole hand on screen.
      const w = colsFor(count) * (tableW + gap);
      const margin = width * 0.012;
      const x = Math.min(Math.max(seat?.x ?? cx, margin + w / 2), width - margin - w / 2);
      return handPose(x, seat?.y ?? cy, tableW, gap, index, count, sprite);
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

/**
 * A phone in portrait: your hand big at the bottom, the piles in the middle, everyone else as
 * small hands along the top.
 */
export function phoneLayout(
  width: number,
  height: number,
  playerIds: readonly string[],
  youId: string,
): TableLayout {
  const others = playerIds.filter((id) => id !== youId);
  const handW = Math.min(width * 0.3, (height * 0.2) / CARD_RATIO);
  const gap = handW * 0.1;
  const pileW = Math.min(width * 0.24, height * 0.13);
  const cols = Math.min(others.length, 6);
  const rows = Math.ceil(others.length / Math.max(cols, 1));
  const cellW = width / Math.max(cols, 1);
  const miniW = Math.min(cellW * 0.36, 30);
  const miniGap = miniW * 0.12;
  const miniBlockH = 2 * miniW * CARD_RATIO + miniGap;
  const rowH = miniBlockH + 26;
  const sprite = Math.round(Math.max(handW, pileW));
  const handH = handW * CARD_RATIO;
  const youY = height - 34 - handH - gap / 2;
  const handTop = youY - handH - gap / 2;
  const stripBottom = 24 + rows * rowH;
  const pileH = pileW * CARD_RATIO;
  const drawnH = handW * 0.9 * CARD_RATIO;
  // Piles under the strip, your drawn card between the piles and your hand, centered as a group.
  const groupH = pileH + 12 + drawnH;
  const groupTop = stripBottom + Math.max(8, (handTop - stripBottom - groupH) / 2);
  const pileY = groupTop + pileH / 2;
  const drawnY = pileY + pileH / 2 + 12 + drawnH / 2;

  const seats: SeatAnchor[] = playerIds.map((playerId) => {
    if (playerId === youId) {
      return {
        playerId,
        x: width / 2,
        y: youY,
        labelX: width / 2,
        labelY: height - 18,
        cardWidth: handW,
      };
    }
    const i = others.indexOf(playerId);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = cellW * (col + 0.5);
    const y = 24 + row * rowH + miniBlockH / 2;
    return { playerId, x, y, labelX: x, labelY: y - miniBlockH / 2 - 9, cardWidth: miniW };
  });
  const seatOf = (id: string) => seats.find((s) => s.playerId === id);

  return {
    width,
    height,
    spriteWidth: sprite,
    deck: { x: width / 2 - pileW * 0.62, y: pileY, scale: pileW / sprite, rotate: 0 },
    discard: { x: width / 2 + pileW * 0.62, y: pileY, scale: pileW / sprite, rotate: 0 },
    seats,
    slot(playerId, index, count) {
      const seat = seatOf(playerId);
      if (!seat) return { x: width / 2, y: pileY, scale: miniW / sprite, rotate: 0 };
      if (playerId === youId) return handPose(seat.x, seat.y, handW, gap, index, count, sprite);
      return handPose(seat.x, seat.y, miniW, miniGap, index, count, sprite);
    },
    drawn(playerId) {
      if (playerId === youId) {
        return { x: width / 2, y: drawnY, scale: (handW * 0.9) / sprite, rotate: 0 };
      }
      const seat = seatOf(playerId);
      return {
        x: seat?.x ?? width / 2,
        y: (seat?.y ?? 0) + miniBlockH * 0.7,
        scale: (miniW * 1.2) / sprite,
        rotate: -3,
      };
    },
    peek(rest, peekerId) {
      if (peekerId === youId)
        return { ...rest, y: rest.y - handW * 0.25, scale: rest.scale * 1.12, rotate: 0 };
      return peekToward(rest, seatOf(peekerId), miniW);
    },
  };
}

/** Every card's resting pose in a scene, by card id. */
export function posesFor(scene: Scene, layout: TableLayout): Map<string, Pose> {
  const out = new Map<string, Pose>();
  for (const seat of scene.seats) {
    seat.slots.forEach((slot, i) => {
      let pose = layout.slot(seat.playerId, i, seat.slots.length);
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
