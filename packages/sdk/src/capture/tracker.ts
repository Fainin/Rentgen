/**
 * Greedy-IoU object tracker (Stream 1, internal to capture/).
 *
 * Turns a stream of noisy per-frame detections into stable trackIds. Each tick:
 *   1. Greedy IoU matching (IoU >= MATCH_IOU) links this frame's boxes to live tracks.
 *   2. Matched tracks age up (hits++, misses=0) with EMA-smoothed boxes.
 *   3. Unmatched tracks age out (misses++, hits=0), dropped after LOST_MISSES.
 *   4. Unmatched detections spawn new `tentative` tracks.
 *
 * Lifecycle: tentative -> confirmed (after CONFIRM_HITS consecutive hits) -> dropped.
 * Only a track that reaches `confirmed` for the first time should trigger a scan — the
 * caller diffs status by trackId (see rentgen-scanner). State is immutable: every
 * `updateTracker` returns a brand-new TrackerState.
 */

import type { Box } from './geometry.js';
import { emaBox, iou } from './geometry.js';
import type { Detection } from './detector.js';

export type TrackStatus = 'tentative' | 'confirmed';

export interface Track {
  readonly id: string;
  /** EMA-smoothed box (what the overlay draws). */
  readonly box: Box;
  readonly status: TrackStatus;
  /** Consecutive matched frames. */
  readonly hits: number;
  /** Consecutive missed frames. */
  readonly misses: number;
  /** Detector confidence from the last matched detection, 0..1. */
  readonly confidence: number;
}

export interface TrackerState {
  readonly tracks: readonly Track[];
  readonly nextId: number;
}

export const MATCH_IOU = 0.3;
export const EMA_ALPHA = 0.4;
export const CONFIRM_HITS = 5;
export const LOST_MISSES = 10;

export function emptyTracker(): TrackerState {
  return { tracks: [], nextId: 1 };
}

interface Pair {
  readonly t: number;
  readonly d: number;
  readonly iou: number;
}

/** Advance the tracker by one detector frame. Returns a new immutable state. */
export function updateTracker(
  state: TrackerState,
  detections: readonly Detection[],
): TrackerState {
  const { tracks } = state;

  // 1. Score every track x detection pair above the IoU floor, best-first.
  const pairs: Pair[] = [];
  for (let t = 0; t < tracks.length; t++) {
    for (let d = 0; d < detections.length; d++) {
      const score = iou(tracks[t].box, detections[d].box);
      if (score >= MATCH_IOU) pairs.push({ t, d, iou: score });
    }
  }
  pairs.sort((a, b) => b.iou - a.iou);

  // 2. Greedy assignment: each track and detection used at most once.
  const matchOf = new Map<number, number>();
  const usedT = new Set<number>();
  const usedD = new Set<number>();
  for (const p of pairs) {
    if (usedT.has(p.t) || usedD.has(p.d)) continue;
    matchOf.set(p.t, p.d);
    usedT.add(p.t);
    usedD.add(p.d);
  }

  const next: Track[] = [];

  // 3. Age existing tracks.
  for (let t = 0; t < tracks.length; t++) {
    const track = tracks[t];
    const d = matchOf.get(t);
    if (d !== undefined) {
      const det = detections[d];
      const hits = track.hits + 1;
      next.push({
        id: track.id,
        box: emaBox(track.box, det.box, EMA_ALPHA),
        status: hits >= CONFIRM_HITS ? 'confirmed' : track.status,
        hits,
        misses: 0,
        confidence: det.score,
      });
    } else {
      const misses = track.misses + 1;
      if (misses >= LOST_MISSES) continue; // lost -> drop
      next.push({ ...track, hits: 0, misses });
    }
  }

  // 4. Spawn tracks for unmatched detections.
  let nextId = state.nextId;
  for (let d = 0; d < detections.length; d++) {
    if (usedD.has(d)) continue;
    const det = detections[d];
    next.push({
      id: String(nextId++),
      box: det.box,
      status: 'tentative',
      hits: 1,
      misses: 0,
      confidence: det.score,
    });
  }

  return { tracks: next, nextId };
}
