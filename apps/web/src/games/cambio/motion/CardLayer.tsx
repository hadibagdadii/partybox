import type { Face } from '@partybox/cambio';
import { animate, cubicBezier, motion, type AnimationPlaybackControls } from 'motion/react';
import { memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Card, type FlipSpec } from '../cards/Card';
import { BACK_IMAGE } from '../cards/CardBack';
import { CARD_RATIO, colors, ease, springs, timing } from '../tokens';
import { posesFor, type Pose, type TableLayout } from './layout';
import type { Highlight, Playing } from './queue';
import type { Scene } from './scene';
import type { CardMove } from './steps';

export interface Perspective {
  /** Null on the TV. */
  youId: string | null;
  /** Faces only this viewer may see now: their drawn card and their peek. */
  privateFaces: Record<string, Face>;
  /**
   * Cards in this viewer's own hand shown face up right now, by card id: the initial peek while
   * held. The phone decides when; a card missing here shows its back.
   */
  handFaces?: Record<string, Face>;
}

const HOST: Perspective = { youId: null, privateFaces: {} };

/** Running animations per card element. */
const moving = new WeakMap<HTMLElement, number>();

interface Item {
  cardId: string;
  pose: Pose;
  face: Face | null;
  faceUp: boolean;
  flip: FlipSpec | null;
  lifted: boolean;
  z: number;
  /** Where the element is placed when it first mounts: the deck for new cards. */
  mount: Pose;
  /** Was in a hand last frame and left the scene: sweeps back to the deck. */
  leaving?: boolean;
}

/** Motion transform values for a pose. */
const values = (p: Pose) => ({
  x: p.x,
  y: p.y,
  scale: p.scale,
  rotate: p.rotate,
  rotateX: p.rotateX ?? 0,
  rotateY: p.rotateY ?? 0,
});

const samePose = (a: Pose, b: Pose) =>
  a.x === b.x &&
  a.y === b.y &&
  a.scale === b.scale &&
  a.rotate === b.rotate &&
  (a.rotateX ?? 0) === (b.rotateX ?? 0) &&
  (a.rotateY ?? 0) === (b.rotateY ?? 0);

const inOut = cubicBezier(...ease.inOutCubic);
const ARC_SAMPLES = 14;

/** Control point of an arc from `a` to `b`, bulging sideways by a share of the distance. */
function arcControl(a: Pose, b: Pose, bend: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const k = 0.44 * bend;
  return { x: (a.x + b.x) / 2 - dy * k, y: (a.y + b.y) / 2 + dx * k };
}

/**
 * Keyframes along a quadratic arc, sampled at evenly spaced times with the easing applied to the
 * path position. One ease runs across the whole arc, so the card never pauses at its midpoint.
 */
function arcKeyframes(from: Pose, to: Pose, bend: number, slam: boolean) {
  const c = arcControl(from, to, bend);
  const peak = Math.max(from.scale, to.scale) * 1.08;
  const x: number[] = [];
  const y: number[] = [];
  const rotate: number[] = [];
  const scale: number[] = [];
  const rotateX: number[] = [];
  const rotateY: number[] = [];
  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const t = i / ARC_SAMPLES;
    const u = inOut(t);
    const m = 1 - u;
    x.push(m * m * from.x + 2 * m * u * c.x + u * u * to.x);
    y.push(m * m * from.y + 2 * m * u * c.y + u * u * to.y);
    // Tilts into the curve and back out; rises toward the viewer at the top of the arc.
    const lift = Math.sin(Math.PI * u);
    rotate.push(from.rotate * m + to.rotate * u + bend * 7 * lift);
    rotateX.push((from.rotateX ?? 0) * m + (to.rotateX ?? 0) * u);
    rotateY.push((from.rotateY ?? 0) * m + (to.rotateY ?? 0) * u);
    const base = from.scale * m + to.scale * u;
    scale.push(
      slam ? base + (peak * 1.06 - base) * lift * (u < 0.86 ? 1 : 0) : base + (peak - base) * lift,
    );
  }
  if (slam) {
    // Lands slightly oversized, then settles: the impact.
    scale[ARC_SAMPLES - 1] = to.scale * 1.05;
    scale[ARC_SAMPLES] = to.scale;
  }
  return { x, y, rotate, scale, rotateX, rotateY };
}

/** Runs one card's move for a step. Times in ms are scaled by `k`. */
function runMove(
  el: HTMLElement,
  from: Pose,
  to: Pose,
  move: CardMove,
  k: number,
): AnimationPlaybackControls[] {
  const delay = (move.delay * k) / 1000;
  const duration = (move.duration * k) / 1000;
  if (move.path === 'spring') {
    return [animate(el, values(to), { ...springs.slide, duration, delay })];
  }
  const frames = arcKeyframes(from, to, move.bend ?? 1, move.path === 'slam');
  return [animate(el, frames, { duration, delay, ease: 'linear' })];
}

/** A small horizontal shake around the card's rest position. */
function runShake(
  el: HTMLElement,
  rest: Pose,
  amp: number,
  delayMs: number,
  durMs: number,
  k: number,
) {
  return animate(
    el,
    { x: [rest.x, rest.x - amp, rest.x + amp, rest.x - amp * 0.6, rest.x + amp * 0.3, rest.x] },
    { duration: (durMs * k) / 1000, delay: (delayMs * k) / 1000, ease: ease.inOutCubic },
  );
}

/**
 * Every card on screen, one element per opaque card id, placed and moved with transforms only.
 * A card keeps its element as it travels between zones, so it never teleports. Poses come from
 * the layout, measured once per size, so no frame ever reads layout.
 */
export function CardLayer({
  scene,
  playing,
  highlight,
  layout,
  perspective = HOST,
  reduced = false,
  timeScale = 1,
  under,
  over,
}: {
  under?: ReactNode;
  over?: ReactNode;
  scene: Scene;
  playing: Playing | null;
  highlight: Highlight | null;
  layout: TableLayout;
  perspective?: Perspective;
  reduced?: boolean;
  timeScale?: number;
}) {
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const placed = useRef(new Map<string, Pose>());
  const running = useRef<{ id: number; controls: AnimationPlaybackControls[] } | null>(null);
  const [leaving, setLeaving] = useState<Item[]>([]);
  const lastItems = useRef<Item[]>([]);
  const step = playing?.step ?? null;
  const k = (playing?.rate ?? 1) * timeScale;

  const items = useMemo(() => {
    const poses = posesFor(scene, layout);
    const out: Item[] = [];
    const flips = new Map(step?.flips.map((f) => [f.cardId, f]));
    const movesById = new Map(step?.moves.map((m) => [m.cardId, m]));
    const { youId, privateFaces, handFaces = {} } = perspective;
    const discardIds = new Set(scene.discard.map((c) => c.cardId));
    scene.discard.forEach((c, i) => {
      const pose = poses.get(c.cardId)!;
      out.push({
        cardId: c.cardId,
        pose,
        mount: pose,
        face: c.face,
        faceUp: true,
        flip: null,
        lifted: false,
        z: 10 + i,
      });
    });
    const peekSlot = scene.peek?.slotId;
    for (const seat of scene.seats) {
      for (const slot of seat.slots) {
        const pose = poses.get(slot.cardId)!;
        const peeking = peekSlot === slot.slotId;
        const own = seat.playerId === youId && youId !== null;
        const mine =
          (peeking && scene.peek?.playerId === youId ? privateFaces[slot.cardId] : undefined) ??
          (own ? handFaces[slot.cardId] : undefined);
        const revealed = scene.revealed[slot.cardId];
        const f = flips.get(slot.cardId);
        const face = mine ?? revealed ?? f?.face ?? null;
        out.push({
          cardId: slot.cardId,
          pose,
          mount: pose,
          face,
          faceUp: !!(mine ?? revealed),
          flip: f
            ? {
                rotateY: f.rotateY,
                times: f.times,
                duration: (f.duration * k) / 1000,
                delay: (f.delay * k) / 1000,
              }
            : null,
          lifted: peeking || !!(own && handFaces[slot.cardId]),
          z: peeking ? 60 : 20,
        });
      }
    }
    if (scene.drawn) {
      const id = scene.drawn.cardId;
      const mine = scene.drawn.playerId === youId ? privateFaces[id] : undefined;
      const pose = poses.get(id)!;
      out.push({
        cardId: id,
        pose,
        mount: pose,
        face: mine ?? null,
        faceUp: !!mine,
        flip: null,
        lifted: true,
        z: 55,
      });
    }
    // New face-up cards start face down on the deck and turn over mid-flight.
    for (const it of out) {
      const m = movesById.get(it.cardId);
      if (m?.fromDeck) it.mount = layout.deck;
      if (it.faceUp && m?.fromDeck && !it.flip) {
        it.flip = {
          rotateY: [180, 0],
          duration: (timing.flip * k) / 1000,
          delay: ((m.delay + m.duration * 0.45) * k) / 1000,
        };
      }
      if (m) it.z = discardIds.has(it.cardId) ? 50 : 70;
    }
    return out;
  }, [scene, layout, step, perspective, k]);

  // Cards that left a hand (a new deal) sweep back to the deck instead of vanishing.
  useLayoutEffect(() => {
    const now = new Set(items.map((i) => i.cardId));
    const gone = lastItems.current.filter((i) => !now.has(i.cardId) && !i.leaving && i.z === 20);
    lastItems.current = items;
    if (step?.kind === 'deal' && gone.length && !reduced) {
      setLeaving(
        gone.map((i) => ({ ...i, faceUp: false, face: null, flip: null, leaving: true, z: 5 })),
      );
    }
  }, [items, step, reduced]);

  useLayoutEffect(() => {
    const nextPlaced = new Map<string, Pose>();
    const fresh = running.current?.id !== playing?.id;
    const controls: AnimationPlaybackControls[] = fresh ? [] : (running.current?.controls ?? []);
    const movesById = new Map(step?.moves.map((m) => [m.cardId, m]));
    const fromScene = step ? posesFor(step.before, layout) : new Map<string, Pose>();
    /** Keeps a card on its own layer exactly while it has animations running. */
    const track = (el: HTMLElement, c: AnimationPlaybackControls) => {
      controls.push(c);
      moving.set(el, (moving.get(el) ?? 0) + 1);
      el.style.willChange = 'transform';
      void c.finished.then(() => {
        const left = (moving.get(el) ?? 1) - 1;
        moving.set(el, left);
        if (left === 0) el.style.willChange = '';
      });
    };

    for (const it of items) {
      const el = nodes.current.get(it.cardId);
      if (!el) continue;
      const prev = placed.current.get(it.cardId);
      const move = fresh ? movesById.get(it.cardId) : undefined;
      nextPlaced.set(it.cardId, it.pose);
      if (reduced) {
        animate(el, values(it.pose), { duration: 0 });
        continue;
      }
      if (move) {
        const from = move.fromDeck
          ? layout.deck
          : (prev ?? fromScene.get(it.cardId) ?? layout.deck);
        if (!prev || move.fromDeck) animate(el, values(from), { duration: 0 });
        for (const c of runMove(el, from, it.pose, move, k)) track(el, c);
      } else if (!prev) {
        animate(el, values(it.pose), { duration: 0 });
      } else if (!samePose(prev, it.pose)) {
        track(
          el,
          animate(el, values(it.pose), {
            ...springs.settle,
            duration: springs.settle.duration * Math.max(k, 0.4),
          }),
        );
      }
    }

    if (fresh && step && !reduced) {
      for (const fx of step.effects) {
        if (fx.kind === 'shake') {
          const el = nodes.current.get(fx.cardId);
          const rest = nextPlaced.get(fx.cardId);
          if (el && rest)
            track(
              el,
              runShake(el, rest, layout.spriteWidth * rest.scale * 0.12, fx.delay, fx.duration, k),
            );
        }
        if (fx.kind === 'pileShake') {
          const slam = step.moves.find((m) => m.path === 'slam')?.cardId;
          for (const c of step.after.discard) {
            if (c.cardId === slam) continue;
            const el = nodes.current.get(c.cardId);
            const rest = nextPlaced.get(c.cardId);
            if (el && rest) track(el, runShake(el, rest, 4, fx.delay, 260, k));
          }
        }
      }
    }

    placed.current = nextPlaced;
    running.current = { id: playing?.id ?? -1, controls };
  }, [items, playing, step, layout, reduced, k]);

  // A long step told to hurry: everything it started plays faster from here.
  const rushed = playing?.rushed?.speedup ?? 1;
  useLayoutEffect(() => {
    if (rushed === 1) return;
    for (const c of running.current?.controls ?? []) c.speed = rushed;
  }, [rushed]);

  useLayoutEffect(() => {
    if (!leaving.length) return;
    const runs = leaving.map((it) => {
      const el = nodes.current.get(`leaving:${it.cardId}`);
      return el
        ? animate(el, values(layout.deck), {
            duration: (timing.exitArc * timeScale) / 1000,
            ease: ease.inOutCubic,
          })
        : null;
    });
    let live = true;
    void Promise.all(runs.map((r) => r?.finished)).then(() => live && setLeaving([]));
    return () => {
      live = false;
    };
  }, [leaving, layout, timeScale]);

  const spriteW = layout.spriteWidth;
  const spriteH = spriteW * CARD_RATIO;
  const highlighted = new Set(highlight?.cardIds ?? []);

  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', perspective: 1600 }}
      data-testid="card-layer"
    >
      {under}
      {leaving.map((it) => {
        const id = `leaving:${it.cardId}`;
        // Plain backs, not full cards: a 12-seat deal sweeps 48 of these at once.
        return (
          <div
            key={id}
            ref={(el) => {
              if (!el) return;
              if (!el.dataset.placed) {
                const p = it.mount;
                el.style.transform = `translateX(${p.x}px) translateY(${p.y}px) scale(${p.scale}) rotate(${p.rotate}deg)`;
                el.dataset.placed = '';
              }
              nodes.current.set(id, el);
            }}
            style={{
              position: 'absolute',
              left: -spriteW / 2,
              top: -spriteH / 2,
              width: spriteW,
              height: spriteH,
              zIndex: it.z,
              borderRadius: '7% / 5%',
              backgroundImage: BACK_IMAGE,
              backgroundSize: '100% 100%',
              // Their own layers for the short sweep, so the table is not repainted each frame.
              willChange: 'transform',
            }}
          />
        );
      })}
      {items.map((it) => (
        <Sprite
          key={it.cardId}
          id={it.cardId}
          item={it}
          nodes={nodes.current}
          spriteW={spriteW}
          spriteH={spriteH}
          highlightKey={highlighted.has(it.cardId) ? (highlight?.key ?? null) : null}
          flipScale={k}
        />
      ))}
      {over}
    </div>
  );
}

const sameFace = (a: Face | null, b: Face | null) =>
  a === b || (!!a && !!b && a.rank === b.rank && a.suit === b.suit);

const sameFlip = (a: FlipSpec | null, b: FlipSpec | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.duration === b.duration &&
    a.delay === b.delay &&
    a.rotateY.join() === b.rotateY.join() &&
    (a.times ?? []).join() === (b.times ?? []).join());

type SpriteProps = {
  id: string;
  item: Item;
  nodes: Map<string, HTMLDivElement>;
  spriteW: number;
  spriteH: number;
  highlightKey: number | null;
  flipScale: number;
};

/**
 * Sprites only re-render when what they draw changes. Position is not part of it: Motion moves
 * the element directly, so a step that moves three cards re-renders none of the others.
 */
function spriteEqual(a: SpriteProps, b: SpriteProps): boolean {
  return (
    a.id === b.id &&
    a.spriteW === b.spriteW &&
    a.highlightKey === b.highlightKey &&
    a.flipScale === b.flipScale &&
    a.item.faceUp === b.item.faceUp &&
    a.item.lifted === b.item.lifted &&
    a.item.z === b.item.z &&
    sameFace(a.item.face, b.item.face) &&
    sameFlip(a.item.flip, b.item.flip)
  );
}

const Sprite = memo(function Sprite({
  id,
  item,
  nodes,
  spriteW,
  spriteH,
  highlightKey,
  flipScale,
}: SpriteProps) {
  return (
    <div
      ref={(el) => {
        if (!el) {
          if (nodes.get(id)?.isConnected === false) nodes.delete(id);
          return;
        }
        if (!el.dataset.placed) {
          // Placed once per element, before paint; Motion owns the transform from then on.
          const p = item.mount;
          el.style.transform = `translateX(${p.x}px) translateY(${p.y}px) scale(${p.scale}) rotate(${p.rotate}deg)`;
          el.dataset.placed = '';
        }
        nodes.set(id, el);
      }}
      data-card-id={item.cardId}
      style={{
        position: 'absolute',
        left: -spriteW / 2,
        top: -spriteH / 2,
        width: spriteW,
        height: spriteH,
        zIndex: item.z,
      }}
    >
      <Card
        face={item.face}
        faceUp={item.faceUp}
        size={spriteW}
        lifted={item.lifted}
        flip={item.flip}
        flipScale={flipScale}
      />
      {highlightKey !== null && (
        <motion.div
          key={highlightKey}
          initial={{ opacity: 1, scale: 1 }}
          animate={{ opacity: 0, scale: 1.06 }}
          transition={{ duration: timing.highlight / 1000, ease: ease.outCubic }}
          style={{
            position: 'absolute',
            inset: -spriteW * 0.04,
            borderRadius: '9% / 6.5%',
            boxShadow: `0 0 0 ${Math.max(3, spriteW * 0.03)}px ${colors.glow}`,
          }}
        />
      )}
    </div>
  );
}, spriteEqual);
