import { useCallback, useEffect, useRef } from 'react';

const SWEEP_TARGET = 35;
const SWEEP_DURATION_MS = 1400;

export function useAutoSweep(onRevealChange: (value: number) => void): () => void {
  const hasSweptRef = useRef(false);
  const cancelledRef = useRef(false);

  const cancelSweep = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  useEffect(() => {
    if (hasSweptRef.current || cancelledRef.current) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const startTime = performance.now();
    let frameId: number;

    const step = (now: number) => {
      if (cancelledRef.current) return;

      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / SWEEP_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      onRevealChange(eased * SWEEP_TARGET);
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        hasSweptRef.current = true;
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [onRevealChange]);

  return cancelSweep;
}
