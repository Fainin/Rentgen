/**
 * Best-in-frame crop selection + dHash re-entry guard (Stream 1, internal to capture/).
 *
 * For a newly-tracked object we buffer a handful of candidate frames (~1 s), score each by
 *     score = sqrt(areaFrac) * centeredness * sharpnessNorm * detectorConfidence
 * and keep the single best crop as a JPEG data URL — that one image is what `scan()` gets
 * and what the whole pipeline persists per item (the "one-image invariant").
 *
 * sharpnessNorm is normalised against the max sharpness *within the buffer*. Since we only
 * ever argmax within one object's buffer (never compare across objects), a per-buffer max is
 * equivalent to a running session max for selection while staying free of global state.
 *
 * dHash: a 64-bit difference hash of the winning crop, compared (Hamming <= RENTRY_HAMMING)
 * against every crop already scanned this session so an object that leaves and re-enters the
 * frame under a fresh trackId is skipped silently. ~no model, pure pixels.
 */

import type { Box } from './geometry.js';
import { boxCenter, clampBox } from './geometry.js';

const MARGIN = 0.1; // 10% padding around the detector box
const MAX_SIDE = 768; // longest side of the final crop
const JPEG_QUALITY = 0.85;
const THUMB = 64; // grayscale thumbnail size for the sharpness metric
export const MAX_CANDIDATES = 8;
export const RENTRY_HAMMING = 10;

export interface CropCandidate {
  /** Final-sized, margined crop pixels — ready to toDataURL / dHash without the video. */
  readonly canvas: HTMLCanvasElement;
  readonly areaFrac: number;
  readonly centeredness: number;
  readonly sharpness: number; // raw Laplacian variance
  readonly confidence: number;
}

type CanvasSource = HTMLVideoElement | HTMLCanvasElement;

function sourceSize(src: CanvasSource): { w: number; h: number } {
  return src instanceof HTMLVideoElement
    ? { w: src.videoWidth, h: src.videoHeight }
    : { w: src.width, h: src.height };
}

function ctxOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
}

/** Variance of the Laplacian over a THUMBxTHUMB grayscale crop — a sharpness/focus proxy. */
function laplacianVariance(src: CanvasSource, box: Box): number {
  const c = document.createElement('canvas');
  c.width = THUMB;
  c.height = THUMB;
  const ctx = ctxOf(c);
  ctx.drawImage(src, box.x, box.y, box.w, box.h, 0, 0, THUMB, THUMB);
  const { data } = ctx.getImageData(0, 0, THUMB, THUMB);

  const gray = new Float32Array(THUMB * THUMB);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < THUMB - 1; y++) {
    for (let x = 1; x < THUMB - 1; x++) {
      const i = y * THUMB + x;
      const lap = gray[i - 1] + gray[i + 1] + gray[i - THUMB] + gray[i + THUMB] - 4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Build the margined, clamped, downscaled final crop canvas for a box. */
function buildCropCanvas(src: CanvasSource, box: Box, frameW: number, frameH: number): HTMLCanvasElement {
  const mx = box.w * MARGIN;
  const my = box.h * MARGIN;
  const region = clampBox(
    { x: box.x - mx, y: box.y - my, w: box.w + 2 * mx, h: box.h + 2 * my },
    frameW,
    frameH,
  );
  const scale = Math.min(1, MAX_SIDE / Math.max(region.w, region.h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(region.w * scale));
  c.height = Math.max(1, Math.round(region.h * scale));
  ctxOf(c).drawImage(src, region.x, region.y, region.w, region.h, 0, 0, c.width, c.height);
  return c;
}

/** Snapshot the current frame's crop for a box into a scored candidate. */
export function captureCandidate(src: CanvasSource, box: Box, confidence: number): CropCandidate {
  const { w: frameW, h: frameH } = sourceSize(src);
  const clamped = clampBox(box, frameW, frameH);
  const areaFrac = frameW * frameH > 0 ? (clamped.w * clamped.h) / (frameW * frameH) : 0;

  const center = boxCenter(clamped);
  const fc = { x: frameW / 2, y: frameH / 2 };
  const maxDist = Math.hypot(fc.x, fc.y) || 1;
  const dist = Math.hypot(center.x - fc.x, center.y - fc.y);
  const centeredness = Math.max(0, 1 - dist / maxDist);

  return {
    canvas: buildCropCanvas(src, clamped, frameW, frameH),
    areaFrac,
    centeredness,
    sharpness: laplacianVariance(src, clamped),
    confidence,
  };
}

/** Pick the best candidate by the combined score; null when the buffer is empty. */
export function pickBest(candidates: readonly CropCandidate[]): CropCandidate | null {
  if (candidates.length === 0) return null;
  const maxSharp = Math.max(...candidates.map((c) => c.sharpness), 1e-6);
  let best: CropCandidate | null = null;
  let bestScore = -Infinity;
  for (const c of candidates) {
    const score = Math.sqrt(c.areaFrac) * c.centeredness * (c.sharpness / maxSharp) * c.confidence;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** Add a candidate to a buffer, capping at MAX_CANDIDATES by dropping the weakest. */
export function pushCandidate(buffer: readonly CropCandidate[], c: CropCandidate): CropCandidate[] {
  const next = [...buffer, c];
  if (next.length <= MAX_CANDIDATES) return next;
  // Drop the lowest prelim score (area*conf*sharpness) — argmax-invariant to normalisation.
  const prelim = (x: CropCandidate): number => Math.sqrt(x.areaFrac) * x.centeredness * x.sharpness * x.confidence;
  let worst = 0;
  for (let i = 1; i < next.length; i++) if (prelim(next[i]) < prelim(next[worst])) worst = i;
  next.splice(worst, 1);
  return next;
}

export function toDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

/** 64-bit difference hash of a crop (9x8 grayscale, compare horizontal neighbours). */
export function dHash(canvas: HTMLCanvasElement): bigint {
  const w = 9;
  const h = 8;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = ctxOf(c);
  ctx.drawImage(canvas, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let bits = 0n;
  let bit = 0n;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      const l = y * w + x;
      const r = y * w + x + 1;
      const lg = 0.299 * data[l * 4] + 0.587 * data[l * 4 + 1] + 0.114 * data[l * 4 + 2];
      const rg = 0.299 * data[r * 4] + 0.587 * data[r * 4 + 1] + 0.114 * data[r * 4 + 2];
      if (lg > rg) bits |= 1n << bit;
      bit++;
    }
  }
  return bits;
}

/** Hamming distance between two 64-bit hashes. */
export function hamming(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

/** True if `hash` matches (Hamming <= RENTRY_HAMMING) any already-scanned crop. */
export function isDuplicate(hash: bigint, seen: readonly bigint[]): boolean {
  return seen.some((s) => hamming(hash, s) <= RENTRY_HAMMING);
}
