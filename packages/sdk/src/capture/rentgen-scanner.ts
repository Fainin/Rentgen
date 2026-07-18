/**
 * <rentgen-scanner> (Stream 1) — camera capture, two modes under one element.
 *
 * Phase 1 (default / fallback): tap-to-capture sends one full photo to scan().
 * Phase 2 (opt-in via the "Live scan" toggle): an on-device detector + IoU tracker find each
 *   object during a slow pan and fire exactly one scan() per object, with a live AR overlay.
 *
 * Both modes end the same way: emit `scan:start`, then getClient().scan(dataUrl). The client
 * emits `scan:complete` / `scan:error`; results render from those — no direct widget coupling.
 * In live mode we additionally `await` the returned ScanResult to draw a price chip on that
 * track's box (no new event or contract — we called scan() ourselves).
 *
 * Gotcha (from the prototype): getUserMedia needs HTTPS or localhost — in-app browsers and
 * plain http://<lan-ip> fail with NotAllowedError. A photo-upload fallback keeps the demo alive.
 */

import { css, html, LitElement } from 'lit';
import { emit } from '../events.js';
import { getClient } from '../config.js';
import type { ScanResult } from '../types.js';
import { loadDetector, reloadDetectorCpu, type Detector } from './detector.js';
import { emptyTracker, updateTracker, type TrackerState } from './tracker.js';
import {
  captureCandidate,
  dHash,
  isDuplicate,
  pickBest,
  pushCandidate,
  toDataUrl,
  type CropCandidate,
} from './crop.js';
import { drawOverlay, type OverlayTheme, type VisualState } from './overlay.js';

const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.85;
const DETECT_INTERVAL_MS = 120; // ~8 detector fps; overlay still redraws every frame.
// A GPU delegate can initialize fine yet read blank frames forever (zero detections).
// After this many consecutive empty inferences (~5 s) we rebuild on CPU once.
const GPU_ZERO_STREAK_LIMIT = 40;

// ---- Capture tuning (2026-07-18): fewer, better finds -------------------------------
// COCO classes that are never worth a listing. Labels are usually junk, but for exactly
// these everyday classes the detector is reliably right — and users were seeing bottles
// and mugs eat scans. "person" is also a privacy line: never crop-scan a human.
const JUNK_LABELS: ReadonlySet<string> = new Set([
  'person',
  'bottle',
  'wine glass',
  'cup',
  'fork',
  'knife',
  'spoon',
  'bowl',
  'banana',
  'apple',
  'orange',
  'broccoli',
  'carrot',
  'sandwich',
  'pizza',
  'donut',
  'cake',
  'potted plant',
  'sink',
  'toilet',
  'refrigerator',
  'oven',
  'microwave',
]);
/** Ignore boxes smaller than this fraction of the frame — background clutter, not a find. */
const MIN_BOX_AREA_FRAC = 0.02;
/** At most this many crops classify/price concurrently; further confirms wait their turn. */
const MAX_CONCURRENT_SCANS = 3;

type Mode = 'tap' | 'live';
type DetectorState = 'idle' | 'loading' | 'ready' | 'error';

interface Visual {
  readonly state: VisualState;
  readonly chip?: string;
}

const DEFAULT_THEME: OverlayTheme = {
  accent: '#86efac',
  radius: 14,
  font: 'system-ui, sans-serif',
};

export class RentgenScanner extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--rentgen-font, system-ui, sans-serif);
    }
    .frame {
      position: relative;
      overflow: hidden;
      border-radius: var(--rentgen-radius, 16px);
      background: var(--rentgen-card-bg, #16181d);
      aspect-ratio: 3 / 4;
      max-height: 60vh;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    canvas.overlay {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .controls {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.75rem;
      padding: 0.9rem 0;
    }
    button.capture {
      appearance: none;
      border: none;
      cursor: pointer;
      background: var(--rentgen-accent, #86efac);
      color: #05230f;
      font: inherit;
      font-weight: 700;
      font-size: 1rem;
      padding: 0.85rem 2.2rem;
      border-radius: 999px;
    }
    button.capture:disabled {
      opacity: 0.5;
      cursor: wait;
    }
    button.toggle {
      appearance: none;
      cursor: pointer;
      background: transparent;
      color: var(--rentgen-accent, #86efac);
      border: 1px solid var(--rentgen-accent, #86efac);
      font: inherit;
      font-weight: 600;
      padding: 0.7rem 1.4rem;
      border-radius: 999px;
    }
    .status {
      color: #9ca3af;
      font-size: 0.85rem;
      text-align: center;
      padding: 0.25rem 0.75rem;
      min-height: 1.2rem;
    }
    .fallback {
      color: #9ca3af;
      font-size: 0.85rem;
      text-align: center;
      padding: 0.75rem;
    }
    .fallback label {
      color: var(--rentgen-accent, #86efac);
      cursor: pointer;
      text-decoration: underline;
    }
    input[type='file'] {
      display: none;
    }
    .retry-row {
      display: flex;
      justify-content: center;
      padding-top: 0.9rem;
    }
    /* Immersive mode: the host app owns the chrome; we own the full-bleed video. */
    :host([immersive]) {
      height: 100%;
    }
    :host([immersive]) .frame {
      aspect-ratio: auto;
      height: 100%;
      max-height: none;
      border-radius: 0;
      background: #000;
    }
    :host([immersive]) .controls,
    :host([immersive]) .status {
      display: none;
    }
    :host([immersive]) .fallback {
      padding-top: 20vh;
    }
  `;

  declare private cameraReady: boolean;
  declare private cameraError: string;
  declare private busy: boolean;
  declare private mode: Mode;
  declare private detectorState: DetectorState;
  declare private liveError: string;
  /** Full-bleed video + auto-start live detection; the host app renders the chrome. */
  declare immersive: boolean;

  static get properties() {
    return {
      cameraReady: { state: true },
      cameraError: { state: true },
      busy: { state: true },
      mode: { state: true },
      detectorState: { state: true },
      liveError: { state: true },
      immersive: { type: Boolean, reflect: true },
    };
  }

  private stream: MediaStream | null = null;
  private detector: Detector | null = null;
  private trackerState: TrackerState = emptyTracker();
  private buffers = new Map<string, CropCandidate[]>();
  private scannedIds = new Set<string>();
  private sessionHashes: bigint[] = [];
  private visuals = new Map<string, Visual>();
  private rafId = 0;
  private lastDetectMs = 0;
  private theme: OverlayTheme = DEFAULT_THEME;
  private zeroStreak = 0;
  private cpuFallbackDone = false;
  private inFlightScans = 0;

  constructor() {
    super();
    this.cameraReady = false;
    this.cameraError = '';
    this.busy = false;
    this.mode = 'tap';
    this.detectorState = 'idle';
    this.liveError = '';
    this.immersive = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    void this.startCamera();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopLoop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    // Detector left loaded on purpose: it's a lazy singleton reused on re-toggle.
  }

  private get video(): HTMLVideoElement | null {
    return this.renderRoot.querySelector('video');
  }

  private get overlayCanvas(): HTMLCanvasElement | null {
    return this.renderRoot.querySelector('canvas.overlay');
  }

  private async startCamera(): Promise<void> {
    // In-app browsers (links opened from chat apps) usually ship NO getUserMedia at all —
    // say so clearly instead of failing cryptically (proven pattern from the prototype).
    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError = window.isSecureContext
        ? 'This browser has no camera support — that usually means an in-app browser. Open this page directly in Safari or Chrome.'
        : 'Camera needs HTTPS (or localhost). Open the https:// link directly.';
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 } },
        audio: false,
      });
      this.cameraReady = true;
      this.cameraError = '';
      await this.updateComplete;
      const video = this.video;
      if (video && this.stream) {
        video.srcObject = this.stream;
        await video.play();
      }
      if (this.immersive) void this.startLive();
    } catch (error: unknown) {
      const name = error instanceof Error ? error.name : 'UnknownError';
      console.error('[rentgen-scanner] getUserMedia failed:', error);
      this.cameraError =
        name === 'NotAllowedError'
          ? 'Camera permission denied (NotAllowedError) — allow camera access for this site in your browser settings, then retry.'
          : name === 'NotFoundError'
            ? 'No camera found on this device (NotFoundError) — use the photo upload instead.'
            : `Camera unavailable (${name}) — retry, or use the photo upload instead.`;
    }
  }

  private onRetryCamera(): void {
    this.cameraError = '';
    void this.startCamera();
  }

  // ---- Phase 1: tap-to-capture -------------------------------------------------

  private captureFrame(): string | null {
    const video = this.video;
    if (!video || video.videoWidth === 0) return null;
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  }

  private async runScan(dataUrl: string): Promise<void> {
    this.busy = true;
    emit('scan:start', {});
    try {
      await getClient().scan(dataUrl);
    } catch {
      /* client already emitted scan:error; the results widget surfaces it */
    } finally {
      this.busy = false;
    }
  }

  private onCapture(): void {
    const dataUrl = this.captureFrame();
    if (dataUrl) void this.runScan(dataUrl);
  }

  private onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') void this.runScan(reader.result);
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  // ---- Phase 2: live pan -------------------------------------------------------

  private onToggleLive(): void {
    if (this.mode === 'live') {
      this.stopLive();
    } else {
      void this.startLive();
    }
  }

  private async startLive(): Promise<void> {
    this.mode = 'live';
    this.liveError = '';
    this.theme = this.readTheme();
    this.resetLiveState();
    await this.updateComplete; // ensure the overlay canvas is in the DOM
    this.startLoop();
    if (this.detector) {
      this.detectorState = 'ready';
      return;
    }
    this.detectorState = 'loading';
    try {
      this.detector = await loadDetector();
      this.detectorState = 'ready';
    } catch {
      this.detectorState = 'error';
      this.liveError = 'On-device detector failed to load. Use tap-to-scan instead.';
    }
  }

  private stopLive(): void {
    this.mode = 'tap';
    this.stopLoop();
    this.resetLiveState();
  }

  private resetLiveState(): void {
    this.trackerState = emptyTracker();
    this.buffers.clear();
    this.scannedIds.clear();
    this.sessionHashes = [];
    this.visuals.clear();
    this.lastDetectMs = 0;
  }

  private startLoop(): void {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(this.tick);
  }

  private stopLoop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private readTheme(): OverlayTheme {
    const s = getComputedStyle(this);
    const accent = s.getPropertyValue('--rentgen-accent').trim() || DEFAULT_THEME.accent;
    const radiusRaw = parseFloat(s.getPropertyValue('--rentgen-radius'));
    const font = s.getPropertyValue('--rentgen-font').trim() || DEFAULT_THEME.font;
    return {
      accent,
      radius: Number.isFinite(radiusRaw) ? radiusRaw : DEFAULT_THEME.radius,
      font,
    };
  }

  private tick = (): void => {
    if (this.mode !== 'live') {
      this.rafId = 0;
      return;
    }
    this.rafId = requestAnimationFrame(this.tick);

    const video = this.video;
    if (!video || video.videoWidth === 0) return;
    const now = performance.now();

    this.renderOverlay(now);

    if (!this.detector || now - this.lastDetectMs < DETECT_INTERVAL_MS) return;
    this.lastDetectMs = now;

    const raw = this.detector.detect(video, now);
    this.watchGpuHealth(raw.length);
    const detections = filterDetections(raw, video.videoWidth * video.videoHeight);
    const next = updateTracker(this.trackerState, detections);
    this.trackerState = next;
    this.syncTracks(next, video);
  };

  /** Swap to the CPU delegate once if the GPU delegate only ever returns empty frames. */
  private watchGpuHealth(detectionCount: number): void {
    if (this.cpuFallbackDone || this.detector?.delegate !== 'GPU') return;
    this.zeroStreak = detectionCount === 0 ? this.zeroStreak + 1 : 0;
    if (this.zeroStreak < GPU_ZERO_STREAK_LIMIT) return;
    this.cpuFallbackDone = true;
    console.warn(
      '[rentgen-scanner] GPU delegate returned no detections for ~5s — rebuilding on CPU',
    );
    void reloadDetectorCpu()
      .then((d) => {
        this.detector = d;
        this.zeroStreak = 0;
      })
      .catch(() => {
        this.detectorState = 'error';
        this.liveError = 'On-device detector failed to load. Use tap-to-scan instead.';
      });
  }

  /** Buffer crops, gate newly-confirmed tracks into scans, prune dead tracks. */
  private syncTracks(next: TrackerState, video: HTMLVideoElement): void {
    const liveIds = new Set<string>();
    for (const track of next.tracks) {
      liveIds.add(track.id);
      if (this.scannedIds.has(track.id)) continue;

      const buffer = pushCandidate(
        this.buffers.get(track.id) ?? [],
        captureCandidate(video, track.box, track.confidence),
      );
      this.buffers.set(track.id, buffer);

      if (track.status === 'confirmed') {
        // Concurrency cap: leave the track unmarked so it retries next tick — it stays
        // confirmed, so it naturally queues until a scan slot frees up.
        if (this.inFlightScans >= MAX_CONCURRENT_SCANS) {
          this.visuals.set(track.id, { state: 'tentative' });
          continue;
        }
        this.scannedIds.add(track.id); // at-most-once, ever
        void this.scanTrack(track.id, buffer);
      } else {
        this.visuals.set(track.id, { state: 'tentative' });
      }
    }
    this.pruneDead(liveIds);
  }

  private pruneDead(liveIds: ReadonlySet<string>): void {
    for (const id of [...this.buffers.keys()]) if (!liveIds.has(id)) this.buffers.delete(id);
    for (const id of [...this.visuals.keys()]) if (!liveIds.has(id)) this.visuals.delete(id);
    for (const id of [...this.scannedIds]) if (!liveIds.has(id)) this.scannedIds.delete(id);
  }

  private async scanTrack(id: string, buffer: readonly CropCandidate[]): Promise<void> {
    const best = pickBest(buffer);
    this.buffers.delete(id); // discard candidates — one-image invariant
    if (!best) {
      this.visuals.set(id, { state: 'failed' });
      return;
    }

    const hash = dHash(best.canvas);
    if (isDuplicate(hash, this.sessionHashes)) {
      this.visuals.delete(id); // re-entry of an already-scanned object — skip silently
      return;
    }
    this.sessionHashes.push(hash);

    this.visuals.set(id, { state: 'scanning' });
    this.inFlightScans++;
    emit('scan:start', {});
    try {
      const dataUrl = toDataUrl(best.canvas);
      const result = await getClient().scan(dataUrl);
      this.visuals.set(id, { state: 'priced', chip: formatChip(result, dataUrl) });
    } catch {
      this.visuals.set(id, { state: 'failed' }); // client already emitted scan:error
    } finally {
      this.inFlightScans--;
    }
  }

  private renderOverlay(now: number): void {
    const canvas = this.overlayCanvas;
    const video = this.video;
    if (!canvas || !video) return;
    const visuals = this.trackerState.tracks
      .filter((t) => this.visuals.has(t.id))
      .map((t) => {
        const v = this.visuals.get(t.id) as Visual;
        return { box: t.box, state: v.state, chip: v.chip };
      });
    drawOverlay(canvas, visuals, video.videoWidth, video.videoHeight, this.theme, now);
  }

  // ---- Render ------------------------------------------------------------------

  private liveStatus(): string {
    if (this.detectorState === 'loading') return 'Loading on-device detector…';
    if (this.detectorState === 'error') return this.liveError;
    if (this.detectorState === 'ready') return 'Pan slowly across your things.';
    return '';
  }

  render() {
    const live = this.mode === 'live';
    return html`
      ${this.cameraReady
        ? html`<div class="frame">
              <video playsinline muted></video>
              ${live ? html`<canvas class="overlay"></canvas>` : ''}
            </div>
            ${live ? html`<div class="status">${this.liveStatus()}</div>` : ''}
            <div class="controls">
              ${live
                ? ''
                : html`<button class="capture" ?disabled=${this.busy} @click=${this.onCapture}>
                    ${this.busy ? 'Scanning…' : '📸 Scan'}
                  </button>`}
              <button class="toggle" @click=${this.onToggleLive}>
                ${live ? 'Stop live' : '🎥 Live scan'}
              </button>
            </div>`
        : html`<div class="fallback">
            ${this.cameraError || 'Starting camera…'}
            ${this.cameraError
              ? html`<div class="retry-row">
                  <button class="capture" @click=${this.onRetryCamera}>Enable camera</button>
                </div>`
              : ''}
          </div>`}
      ${this.immersive && this.cameraReady
        ? ''
        : html`<div class="fallback">
            <label>
              or scan a photo
              <input type="file" accept="image/*" @change=${this.onFilePicked} />
            </label>
          </div>`}
    `;
  }
}

/** Capture-tuning gate: drop junk classes and background-sized boxes before tracking. */
function filterDetections<
  T extends { readonly box: { readonly w: number; readonly h: number }; readonly label: string },
>(detections: readonly T[], frameArea: number): readonly T[] {
  if (frameArea <= 0) return detections;
  return detections.filter(
    (d) =>
      !JUNK_LABELS.has(d.label.toLowerCase()) &&
      (d.box.w * d.box.h) / frameArea >= MIN_BOX_AREA_FRAC,
  );
}

function formatChip(result: ScanResult, scanImage: string): string {
  // The client returns the ACCUMULATED inventory. Prefer the item carrying the exact crop
  // we sent; with per-item sub-cropping that match can miss, so fall back to the newest
  // item (last in the merged list) — for a single-object crop that IS this object.
  const item = result.items.find((i) => i.image === scanImage) ?? result.items.at(-1);
  if (!item) return '✓';
  const sym = currencySymbol(result.currency);
  const min = Math.round(item.resale.min);
  const max = Math.round(item.resale.max);
  return `✓ ${sym}${min}–${max}`;
}

function currencySymbol(currency: string): string {
  switch (currency) {
    case 'EUR':
      return '€';
    case 'USD':
      return '$';
    case 'GBP':
      return '£';
    default:
      return `${currency} `;
  }
}

if (!customElements.get('rentgen-scanner')) {
  customElements.define('rentgen-scanner', RentgenScanner);
}
