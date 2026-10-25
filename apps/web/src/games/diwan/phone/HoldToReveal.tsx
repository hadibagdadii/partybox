import { useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';

type HoldBindings = Pick<
  HTMLAttributes<HTMLElement>,
  | 'onPointerDown'
  | 'onPointerUp'
  | 'onPointerCancel'
  | 'onPointerLeave'
  | 'onKeyDown'
  | 'onKeyUp'
  | 'onBlur'
  | 'onContextMenu'
>;

/**
 * Pressed-and-held state for secret info: true only while a finger, mouse button,
 * or Space/Enter is down. Any release, cancel, blur, or tab switch hides again.
 */
export function useHold(): { held: boolean; bind: HoldBindings } {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!held) return;
    const hide = () => setHeld(false);
    window.addEventListener('pointerup', hide);
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('pointerup', hide);
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [held]);

  const hide = () => setHeld(false);
  const isHoldKey = (key: string) => key === ' ' || key === 'Enter';
  return {
    held,
    bind: {
      onPointerDown: (e) => {
        if (e.button > 0) return;
        e.preventDefault();
        setHeld(true);
      },
      onPointerUp: hide,
      onPointerCancel: hide,
      onPointerLeave: hide,
      onKeyDown: (e) => {
        if (!isHoldKey(e.key)) return;
        e.preventDefault();
        setHeld(true);
      },
      onKeyUp: (e) => {
        if (isHoldKey(e.key)) hide();
      },
      onBlur: hide,
      // Long-press opens a context menu on Android; it would steal the release.
      onContextMenu: (e) => e.preventDefault(),
    },
  };
}

/** A button that shows `children` only while held, and `cover` otherwise. */
export function HoldToReveal({
  label,
  cover,
  children,
  className = '',
}: {
  /** Accessible name for the button. */
  label: string;
  cover: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { held, bind } = useHold();
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={held}
      className={`no-callout block w-full ${className}`}
      {...bind}
    >
      {held ? <div data-testid="revealed">{children}</div> : cover}
    </button>
  );
}
