/**
 * In-browser object detector (Stream 1, internal to capture/).
 *
 * Wraps MediaPipe Tasks Vision EfficientDet-Lite0 (~4.5 MB, Apache-2.0). Boxes are the
 * product; labels are garbage we ignore — every box above a LOW threshold counts, because
 * Stream 2 does the real "what is this?" on the crop. The model + WASM are lazy-loaded via
 * dynamic import on the first camera start, so they never block first paint.
 *
 * If MediaPipe ever fights the bundler, this is the only file to swap for @tensorflow-models/
 * coco-ssd — the Detector interface below is what the scanner depends on, nothing else.
 */

import type { Box } from './geometry.js';

export interface Detection {
  readonly box: Box;
  readonly score: number;
  /** Disposable COCO label — kept only for debugging; the pipeline never reads it. */
  readonly label: string;
}

export interface Detector {
  /** Which delegate this instance runs on — the scanner uses this for the CPU fallback. */
  readonly delegate: 'GPU' | 'CPU';
  /** Run one inference over the current video frame. `timestampMs` must be monotonic. */
  detect(video: HTMLVideoElement, timestampMs: number): readonly Detection[];
  close(): void;
}

// Tuning history: 0.25 flooded busy scenes with marginal boxes; 0.4 proved too strict on
// real pans (missed finds). 0.3 + the junk-class/area filters is the current balance.
const SCORE_THRESHOLD = 0.3;
const MAX_RESULTS = 10;
const MP_VERSION = '0.10.35';
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite';

// Minimal shapes of the MediaPipe result we consume (avoids a hard type dependency at the
// call sites and keeps this the single point of contact with the vendor API).
interface MpBoundingBox {
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
}
interface MpCategory {
  readonly score: number;
  readonly categoryName?: string;
}
interface MpDetection {
  readonly boundingBox?: MpBoundingBox;
  readonly categories: readonly MpCategory[];
}
interface MpObjectDetector {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): { readonly detections: readonly MpDetection[] };
  close(): void;
}

let loadPromise: Promise<Detector> | null = null;

/** Lazy-load the detector once; concurrent callers share the same promise. */
export function loadDetector(): Promise<Detector> {
  if (!loadPromise) loadPromise = createDetector();
  return loadPromise;
}

/**
 * Rebuild forcing the CPU delegate. Some environments initialize a GPU delegate without
 * error but silently return ZERO detections forever (blank texture reads) — the scanner
 * calls this when live inference stays empty for a few seconds.
 */
export function reloadDetectorCpu(): Promise<Detector> {
  loadPromise = createDetector('CPU');
  return loadPromise;
}

async function createDetector(force?: 'CPU'): Promise<Detector> {
  const { FilesetResolver, ObjectDetector } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);

  const build = (delegate: 'GPU' | 'CPU'): Promise<MpObjectDetector> =>
    ObjectDetector.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      scoreThreshold: SCORE_THRESHOLD,
      maxResults: MAX_RESULTS,
    }) as unknown as Promise<MpObjectDetector>;

  // GPU is much faster but unavailable on some devices/browsers — fall back to CPU.
  let impl: MpObjectDetector;
  let delegate: 'GPU' | 'CPU';
  if (force === 'CPU') {
    impl = await build('CPU');
    delegate = 'CPU';
  } else {
    try {
      impl = await build('GPU');
      delegate = 'GPU';
    } catch {
      impl = await build('CPU');
      delegate = 'CPU';
    }
  }

  return {
    delegate,
    detect(video, timestampMs) {
      const result = impl.detectForVideo(video, timestampMs);
      const out: Detection[] = [];
      for (const det of result.detections) {
        const bb = det.boundingBox;
        if (!bb) continue;
        out.push({
          box: { x: bb.originX, y: bb.originY, w: bb.width, h: bb.height },
          score: det.categories[0]?.score ?? 0,
          label: det.categories[0]?.categoryName ?? '',
        });
      }
      return out;
    },
    close() {
      impl.close();
    },
  };
}
