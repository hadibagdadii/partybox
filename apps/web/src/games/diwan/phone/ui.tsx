import { theme, type DecreeId } from '@partybox/diwan';
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { colors } from '../tokens';
import { ArchFrame, CrossedBlades, Star8, StarRule } from './ornaments';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-court-goldLight to-court-gold text-court-ink shadow-glow active:from-court-gold active:to-court-goldDark',
  secondary:
    'border border-court-gold/60 bg-court-dusk/80 text-court-parchment active:bg-court-indigo',
  danger: 'bg-court-danger text-white shadow-lift active:brightness-90',
  ghost: 'text-court-mist active:text-court-parchment',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`min-h-tap w-full rounded-button px-5 text-xl font-semibold transition-transform duration-fast motion-safe:active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * One screen: scrolling content on top, primary actions pinned to the bottom third
 * where a thumb reaches them.
 */
export function Frame({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-safe py-4">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 motion-safe:animate-rise">
          {children}
        </div>
      </div>
      {actions && (
        <div className="border-t border-court-gold/20 bg-court-night/90 px-safe pb-safe pt-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-md flex-col gap-3">{actions}</div>
        </div>
      )}
    </>
  );
}

export function Title({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <header className="flex flex-col items-center gap-2 text-center">
      <h1 className="font-display text-4xl leading-tight text-court-goldLight">{children}</h1>
      <StarRule />
      {hint && <p className="text-lg text-court-mist">{hint}</p>}
    </header>
  );
}

/** A large selectable card for a person. */
export function PlayerCard({
  name,
  tag,
  selected,
  onSelect,
  disabled,
}: {
  name: string;
  tag?: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex min-h-[4.5rem] w-full items-center gap-4 rounded-card border-2 px-4 text-left transition-colors duration-fast ${
        selected
          ? 'border-court-goldLight bg-court-gold/20 text-court-goldLight shadow-glow'
          : 'border-court-indigo bg-court-dusk active:bg-court-indigo'
      }`}
    >
      <Star8
        size={28}
        className={selected ? 'text-court-goldLight' : 'text-court-indigoLight'}
        stroke={selected ? colors.ink : 'none'}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-2xl font-semibold">{name}</span>
        {tag && <span className="text-sm uppercase tracking-wider text-court-mist">{tag}</span>}
      </span>
      {selected && <span className="text-sm font-semibold uppercase text-court-goldLight">✓</span>}
    </button>
  );
}

/**
 * A decree card. Loyal and Rebel differ in color, symbol (star vs. crossed blades),
 * arch shape (round vs. ogee), and lightness, so they read without color.
 */
export function DecreeCard({
  decree,
  selected = false,
  onSelect,
  mark,
  size = 'md',
}: {
  decree: DecreeId;
  selected?: boolean;
  onSelect?: () => void;
  /** Small caption shown on the selected card, e.g. "Discard". */
  mark?: string;
  size?: 'sm' | 'md';
}) {
  const loyal = decree === 'loyal';
  const body = (
    <span
      className={`relative flex w-full flex-col items-center justify-end gap-2 px-2 pb-3 ${
        size === 'sm' ? 'aspect-[3/4] pt-6' : 'aspect-[5/7] pt-8'
      }`}
      style={{ color: loyal ? colors.loyalInk : colors.rebelInk }}
    >
      <ArchFrame
        shape={loyal ? 'round' : 'ogee'}
        fill={loyal ? colors.loyal : colors.rebel}
        stroke={loyal ? colors.gold : colors.indigoLight}
      />
      <span className="relative flex flex-1 items-center">
        {loyal ? (
          <Star8 size={size === 'sm' ? 40 : 52} fill={colors.loyalInk} stroke={colors.gold} />
        ) : (
          <CrossedBlades size={size === 'sm' ? 42 : 56} color={colors.rebelInk} />
        )}
      </span>
      <span
        className={`relative text-center font-serif font-bold leading-tight ${size === 'sm' ? 'text-sm' : 'text-base'}`}
      >
        {theme.decrees[decree]}
      </span>
      {selected && mark && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-court-goldLight px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-court-ink shadow-lift">
          {mark}
        </span>
      )}
    </span>
  );
  if (!onSelect) return <div className="w-full">{body}</div>;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={theme.decrees[decree]}
      onClick={onSelect}
      className={`w-full rounded-card transition-transform duration-base ${
        selected
          ? 'motion-safe:-translate-y-2 drop-shadow-[0_0_10px_rgba(240,207,126,0.8)]'
          : 'opacity-90'
      }`}
    >
      {body}
    </button>
  );
}

/** Slides up from the bottom; closes on the backdrop, the Close button, or Escape. */
export function BottomSheet({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label={theme.phone.close}
        tabIndex={-1}
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[80dvh] flex-col rounded-t-sheet border-t border-court-gold/40 bg-court-dusk pb-safe shadow-lift motion-safe:animate-rise"
      >
        <div className="flex items-center justify-between gap-4 px-safe pb-2 pt-4">
          <h2 className="font-display text-3xl text-court-goldLight">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="min-h-tap-min rounded-button px-4 text-lg text-court-mist active:text-court-parchment"
          >
            {theme.phone.close}
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-safe pb-4">{children}</div>
      </div>
    </div>
  );
}

/** A centered confirmation dialog for irreversible choices. */
export function ConfirmDialog({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  // Portaled: screens animate with transforms, which would trap a fixed overlay inside them.
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 px-safe pb-safe">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={message}
        className="mx-auto mb-3 flex w-full max-w-md flex-col gap-4 rounded-sheet border border-court-danger/60 bg-court-dusk p-5 shadow-lift motion-safe:animate-rise"
      >
        <p className="text-center font-serif text-2xl">{message}</p>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {theme.phone.cancel}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
