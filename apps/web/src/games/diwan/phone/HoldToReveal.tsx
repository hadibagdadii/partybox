import type { ReactNode } from 'react';
import { useHold } from '../../../lib/useHold';

export { useHold };

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
