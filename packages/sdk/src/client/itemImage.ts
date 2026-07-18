/**
 * Per-item card photos (Stream 4). When the classifier localizes an object (item.box),
 * crop the scan image down to it so two products in one photo stop sharing one image.
 * Items without a usable box keep the full scan image — cropping must never fail a scan.
 */

import type { BoundingBox, EnrichedItem } from '../types.js';

const CROP_MARGIN = 0.08; // fraction of the box added on each side
const MAX_SIDE = 768;
const JPEG_QUALITY = 0.85;

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('scan image failed to decode'));
    img.src = dataUrl;
  });
}

function cropToBox(img: HTMLImageElement, box: BoundingBox): string | null {
  const marginX = box.w * CROP_MARGIN;
  const marginY = box.h * CROP_MARGIN;
  const x = Math.max(0, (box.x - marginX) * img.naturalWidth);
  const y = Math.max(0, (box.y - marginY) * img.naturalHeight);
  const w = Math.min(img.naturalWidth - x, (box.w + 2 * marginX) * img.naturalWidth);
  const h = Math.min(img.naturalHeight - y, (box.h + 2 * marginY) * img.naturalHeight);
  if (w < 8 || h < 8) return null;

  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

/**
 * Attach a photo to every item: a tight per-item crop where a box is available, the full
 * scan image otherwise. Never throws — any cropping failure degrades to the full image.
 */
export async function attachItemImages(
  items: readonly EnrichedItem[],
  imageBase64: string,
): Promise<readonly EnrichedItem[]> {
  const withFull = items.map((item) => ({ ...item, image: imageBase64 }));
  if (!items.some((item) => item.box)) return withFull;

  let img: HTMLImageElement;
  try {
    img = await loadImage(imageBase64);
  } catch {
    return withFull;
  }

  return withFull.map((item) => {
    if (!item.box) return item;
    try {
      const cropped = cropToBox(img, item.box);
      return cropped ? { ...item, image: cropped } : item;
    } catch {
      return item;
    }
  });
}
