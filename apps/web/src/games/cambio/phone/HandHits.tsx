import { theme, type Face } from '@partybox/cambio';
import type { HoldBindings } from '../../../lib/useHold';
import { handCols, type PhoneLayout } from '../motion/layout';
import { CARD_RATIO, colors } from '../tokens';
import { useTapSwipe } from './gesture';
import { EyeIcon } from './ui';

export interface HandSlot {
  slotId: string;
  cardId: string;
  pos: number;
}

/**
 * Touch targets over your own cards. The cards themselves are drawn by the card layer; these
 * buttons sit exactly on top of them, so a tap, a swipe up, or a press-and-hold lands on the
 * card you see. The whole hand area never scrolls the page or pulls to refresh.
 */
export function HandHits({
  layout,
  me,
  slots,
  hold,
  onTap,
  onSwipe,
  tappable,
  selected,
  marked,
  known,
  faces,
  locked = false,
}: {
  layout: PhoneLayout;
  me: string;
  slots: HandSlot[];
  /** During the initial peek the whole hand is one press-and-hold target. */
  hold?: HoldBindings;
  onTap?: (slotId: string) => void;
  onSwipe?: (slotId: string) => void;
  /** Whether a tap on this card does anything now. */
  tappable: (slotId: string) => boolean;
  /** The card picked for a Snap button. */
  selected: string | null;
  /** Cards to point out: the ones you may give, or may peek at. */
  marked: Set<string>;
  /** Cards you remember (rememberPeeks): a small eye badge. */
  known: Set<string>;
  /** Faces on screen in your hand right now (a peek, or what you remember), by slot id. */
  faces: Record<string, Face>;
  /** You called Cambio with lockCaller on. */
  locked?: boolean;
}) {
  const { top, bottom } = layout.regions.hand;
  const cols = handCols(slots.map((s) => s.pos));
  return (
    <div
      data-testid="hand"
      aria-label={theme.phone.yourHand}
      role="group"
      className="no-select no-callout absolute inset-x-0 z-[80]"
      style={{ top, height: bottom - top, touchAction: 'none', overscrollBehavior: 'none' }}
    >
      {hold && (
        <button
          type="button"
          aria-label={theme.phone.holdToPeek}
          className="absolute inset-0 h-full w-full cursor-pointer bg-transparent"
          {...hold}
        />
      )}
      {!hold &&
        slots.map((s) => (
          <SlotHit
            key={s.slotId}
            slot={s}
            pose={layout.slot(me, s.pos, cols)}
            sprite={layout.spriteWidth}
            top={top}
            onTap={onTap}
            onSwipe={onSwipe}
            tappable={tappable(s.slotId)}
            selected={selected === s.slotId}
            marked={marked.has(s.slotId)}
            known={known.has(s.slotId)}
            face={faces[s.slotId] ?? null}
            locked={locked}
          />
        ))}
    </div>
  );
}

function SlotHit({
  slot,
  pose,
  sprite,
  top,
  onTap,
  onSwipe,
  tappable,
  selected,
  marked,
  known,
  face,
  locked,
}: {
  slot: HandSlot;
  pose: { x: number; y: number; scale: number };
  sprite: number;
  top: number;
  onTap?: (slotId: string) => void;
  onSwipe?: (slotId: string) => void;
  tappable: boolean;
  selected: boolean;
  marked: boolean;
  known: boolean;
  face: Face | null;
  locked: boolean;
}) {
  const w = pose.scale * sprite;
  const h = w * CARD_RATIO;
  const bind = useTapSwipe({
    onTap: tappable && onTap ? () => onTap(slot.slotId) : undefined,
    onSwipe: onSwipe ? () => onSwipe(slot.slotId) : undefined,
  });
  const ring = selected ? colors.glow : marked ? colors.brassLight : null;
  return (
    <button
      type="button"
      data-slot={slot.slotId}
      aria-label={theme.phone.cardLabel(theme.phone.yourCard(slot.pos + 1), face, {
        known,
        locked,
      })}
      aria-pressed={selected}
      aria-disabled={!tappable && !onSwipe}
      onClick={(e) => {
        // Keyboard activation; pointer presses are handled by the gesture.
        if (e.detail === 0 && tappable) onTap?.(slot.slotId);
      }}
      className="absolute rounded-[8%/5.7%] bg-transparent outline-none focus-visible:shadow-[0_0_0_3px_#f2d27a]"
      style={{
        left: pose.x - w / 2,
        top: pose.y - top - h / 2,
        width: w,
        height: h,
        boxShadow: ring ? `0 0 0 3px ${ring}` : undefined,
        transition: 'box-shadow 150ms ease',
      }}
      {...bind}
    >
      {known && (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 grid size-6 place-items-center rounded-full"
          style={{
            background: colors.ink,
            color: colors.glow,
            boxShadow: '0 1px 3px rgba(0,0,0,.5)',
          }}
        >
          <EyeIcon />
        </span>
      )}
    </button>
  );
}
