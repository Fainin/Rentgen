/**
 * AR overlay renderer (Stream 1, internal to capture/).
 *
 * One <canvas> laid over the <video>. Each detector tick we clear it and redraw the
 * EMA-smoothed track boxes in their current visual state:
 *   tentative -> thin outline · scanning -> pulsing accent · priced -> solid + price chip.
 * The video uses object-fit: cover, so source-pixel boxes are mapped through the same
 * cover transform to land on the displayed frame. devicePixelRatio-aware for crisp lines.
 */

import type { Box } from './geometry.js';

export type VisualState = 'tentative' | 'scanning' | 'priced' | 'failed';

export interface TrackVisual {
  readonly box: Box; // source-video pixels
  readonly state: VisualState;
  readonly chip?: string; // e.g. "✓ €60–90"
}

export interface OverlayTheme {
  readonly accent: string;
  readonly radius: number;
  readonly font: string;
}

/** Map a source-pixel box onto the displayed (object-fit: cover) video, in CSS pixels. */
function coverMap(box: Box, srcW: number, srcH: number, dispW: number, dispH: number): Box {
  if (srcW === 0 || srcH === 0) return box;
  const scale = Math.max(dispW / srcW, dispH / srcH);
  const offsetX = (dispW - srcW * scale) / 2;
  const offsetY = (dispH - srcH * scale) / 2;
  return {
    x: box.x * scale + offsetX,
    y: box.y * scale + offsetY,
    w: box.w * scale,
    h: box.h * scale,
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Redraw the overlay for the current frame.
 * @param nowMs monotonic clock for the scanning pulse animation.
 */
export function drawOverlay(
  canvas: HTMLCanvasElement,
  visuals: readonly TrackVisual[],
  srcW: number,
  srcH: number,
  theme: OverlayTheme,
  nowMs: number,
): void {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW === 0 || cssH === 0) return;

  const pxW = Math.round(cssW * dpr);
  const pxH = Math.round(cssH * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW;
    canvas.height = pxH;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.font = `600 ${Math.max(12, Math.round(cssW * 0.035))}px ${theme.font}`;
  ctx.textBaseline = 'middle';

  const pulse = 0.5 + 0.5 * Math.sin(nowMs / 180);

  for (const v of visuals) {
    const b = coverMap(v.box, srcW, srcH, cssW, cssH);

    if (v.state === 'tentative') {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
    } else if (v.state === 'scanning') {
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2 + 2 * pulse;
      ctx.globalAlpha = 0.55 + 0.45 * pulse;
    } else if (v.state === 'failed') {
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 3;
    }

    roundRect(ctx, b.x, b.y, b.w, b.h, theme.radius);
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (v.chip) drawChip(ctx, v.chip, b, theme);
  }
}

function drawChip(ctx: CanvasRenderingContext2D, text: string, box: Box, theme: OverlayTheme): void {
  const padX = 8;
  const metrics = ctx.measureText(text);
  const chipW = metrics.width + padX * 2;
  const chipH = 22;
  const x = box.x;
  const y = Math.max(chipH / 2, box.y - chipH / 2 - 2);

  ctx.fillStyle = theme.accent;
  roundRect(ctx, x, y - chipH / 2, chipW, chipH, Math.min(theme.radius, chipH / 2));
  ctx.fill();
  ctx.fillStyle = '#05230f';
  ctx.fillText(text, x + padX, y + 1);
}
