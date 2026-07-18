import { useEffect, useState } from 'react';
import { SCAN_ITEMS, TOTAL_RENT, TOTAL_SELL } from './items';

const SWEEP_MS = 6500;
const HOLD_MS = 2600;
const LERP = 0.14;

export interface ScanState {
  /** Beam progress 0..1 through the sweep (1 during hold). */
  progress: number;
  /** False during the hold phase — the beam fades out. */
  beamOn: boolean;
  /** Lerped running totals in EUR. */
  total: number;
  rentTotal: number;
  /** Number of leading items currently lit. */
  litCount: number;
  /** True when prefers-reduced-motion froze the loop at the fully-revealed state. */
  isStatic: boolean;
}

const STATIC_STATE: ScanState = {
  progress: 1,
  beamOn: false,
  total: TOTAL_SELL,
  rentTotal: TOTAL_RENT,
  litCount: SCAN_ITEMS.length,
  isStatic: true,
};

/** Item i lights up once the beam has passed its row-share of the sweep. */
export function litCountAt(progress: number): number {
  const n = SCAN_ITEMS.length;
  let count = 0;
  for (let i = 0; i < n; i++) {
    if ((i + 0.5) / n <= progress) count = i + 1;
  }
  return count;
}

export function useScanLoop(): ScanState {
  const [state, setState] = useState<ScanState>({
    progress: 0,
    beamOn: true,
    total: 0,
    rentTotal: 0,
    litCount: 0,
    isStatic: false,
  });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setState(STATIC_STATE);
      return;
    }

    const start = performance.now();
    let disp = 0;
    let dispRent = 0;
    let frameId: number;

    const tick = (now: number) => {
      const t = (now - start) % (SWEEP_MS + HOLD_MS);
      const progress = t < SWEEP_MS ? t / SWEEP_MS : 1;
      const beamOn = t < SWEEP_MS;
      const lit = litCountAt(progress);

      let target = 0;
      let rentTarget = 0;
      for (let i = 0; i < lit; i++) {
        target += SCAN_ITEMS[i].sell;
        rentTarget += SCAN_ITEMS[i].rent;
      }

      disp += (target - disp) * LERP;
      dispRent += (rentTarget - dispRent) * LERP;
      if (Math.abs(target - disp) < 0.5) disp = target;
      if (Math.abs(rentTarget - dispRent) < 0.5) dispRent = rentTarget;

      setState({ progress, beamOn, total: disp, rentTotal: dispRent, litCount: lit, isStatic: false });
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return state;
}
