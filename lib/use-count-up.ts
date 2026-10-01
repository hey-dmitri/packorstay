'use client';

import { useLayoutEffect, useState } from 'react';

/** Fast out, slow in — the number decelerates into its final value. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Roll a number up to its value.
 *
 * The result is already computed before this runs — nothing is being waited
 * for, and the page stays interactive throughout (PROJECT.md D14). The motion
 * is presentational only.
 *
 * State is held ONLY while an animation is in flight. The rest of the time the
 * hook simply returns the real value, so live editing snaps instantly instead
 * of re-rolling on every keystroke, and a reduced-motion user never sees a
 * partial figure at all.
 *
 * `animate` is expected to be true when the component mounts and to be turned
 * off once the reveal is over.
 */
export function useCountUp(value: number, animate: boolean, durationMs = 700): number {
  /*
   * STARTS ON THE REAL VALUE, NOT ZERO.
   *
   * This used to start at 0 so that no frame showed the final figure before the
   * roll began. But the answer page is rendered on the server, and on the
   * server no animation ever runs — so the HTML a visitor saw before the
   * scripts loaded, and everything that reads the raw page, said "would leave
   * you $0 a year better off". And a reduced-motion visitor, for whom the
   * effect below returns early, sat on $0 for the whole 1.2s the reveal flag
   * stays up.
   *
   * So the true value is the default, and the drop to zero happens in a layout
   * effect: after React has the DOM but before the browser paints it, so an
   * answer arriving by client navigation still never shows its final figure
   * first. On a direct visit the server's real number is replaced by the roll
   * once the scripts are in — the same number, arriving again.
   */
  const [rolled, setRolled] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!animate || prefersReducedMotion()) return;
    setRolled(0);

    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - start) / durationMs);
      // setState inside a rAF callback, not in the effect body.
      setRolled(progress < 1 ? value * easeOutCubic(progress) : null);
      if (progress < 1) frame = requestAnimationFrame(step);
    });

    return () => {
      cancelAnimationFrame(frame);
      // Cut short — by an edit mid-roll, or the reveal flag dropping — means
      // the real value, never a frozen partial one.
      setRolled(null);
    };
  }, [value, animate, durationMs]);

  // Once the reveal is over, or if motion is off, always show the true value.
  return animate && rolled !== null ? rolled : value;
}
