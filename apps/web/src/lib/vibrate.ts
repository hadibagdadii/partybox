import { useEffect, useRef } from 'react';

/** A short buzz each time `myTurn` goes from false to true, where vibration is supported. */
export function useTurnBuzz(myTurn: boolean): void {
  const was = useRef(myTurn);
  useEffect(() => {
    if (myTurn && !was.current) {
      try {
        navigator.vibrate?.(80);
      } catch {
        // Some browsers throw without a prior user gesture.
      }
    }
    was.current = myTurn;
  }, [myTurn]);
}

/** A haptic tap where supported: `ms` long, or a pattern. Never throws. */
export function buzz(pattern: number | number[] = 40): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Some browsers throw without a prior user gesture.
  }
}
