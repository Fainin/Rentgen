/**
 * Box geometry helpers (Stream 1, internal to capture/). All boxes are axis-aligned
 * rectangles in *source-video pixels* (x, y = top-left; w, h = size). Pure functions.
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function boxArea(b: Box): number {
  return Math.max(0, b.w) * Math.max(0, b.h);
}

export function boxCenter(b: Box): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Intersection-over-union of two boxes, 0..1. */
export function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const iw = x2 - x1;
  const ih = y2 - y1;
  if (iw <= 0 || ih <= 0) return 0;
  const inter = iw * ih;
  const union = boxArea(a) + boxArea(b) - inter;
  return union <= 0 ? 0 : inter / union;
}

/** Clamp a box to lie fully inside a frame of the given size. */
export function clampBox(b: Box, frameW: number, frameH: number): Box {
  const x = Math.max(0, Math.min(b.x, frameW));
  const y = Math.max(0, Math.min(b.y, frameH));
  const w = Math.max(0, Math.min(b.w, frameW - x));
  const h = Math.max(0, Math.min(b.h, frameH - y));
  return { x, y, w, h };
}

/** Component-wise exponential moving average: alpha weights the newest sample. */
export function emaBox(prev: Box, next: Box, alpha: number): Box {
  const mix = (p: number, n: number): number => alpha * n + (1 - alpha) * p;
  return {
    x: mix(prev.x, next.x),
    y: mix(prev.y, next.y),
    w: mix(prev.w, next.w),
    h: mix(prev.h, next.h),
  };
}
