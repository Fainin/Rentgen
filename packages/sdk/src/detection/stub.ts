/**
 * Offline DetectionAdapter stub (Stream 2). Deterministic: the same image string always
 * yields the same objects, so the whole chain demos with no key and no network.
 */

import type { DetectionAdapter } from '../adapters/types.js';
import type { DetectedObject } from '../types.js';

const CATALOG: ReadonlyArray<Omit<DetectedObject, 'id'>> = [
  { name: 'MacBook Pro 14" M3', category: 'Computing', condition: 'used - good', confidence: 0.94 },
  { name: 'Sony α7 III', category: 'Photography', condition: 'used - good', confidence: 0.91 },
  { name: 'PlayStation 5 Slim', category: 'Gaming', condition: 'like new', confidence: 0.88 },
  { name: 'Bose QuietComfort 45', category: 'Audio', condition: 'used - visible wear', confidence: 0.85 },
  { name: 'Bosch 18V cordless drill', category: 'Tools', condition: 'used - good', confidence: 0.8 },
];

function seedFrom(imageBase64: string): number {
  let seed = 7;
  const step = Math.max(1, Math.floor(imageBase64.length / 64));
  for (let i = 0; i < imageBase64.length; i += step) {
    seed = (seed * 31 + imageBase64.charCodeAt(i)) >>> 0;
  }
  return seed;
}

export function createStubDetectionAdapter(): DetectionAdapter {
  const detect = async (imageBase64: string): Promise<DetectedObject[]> => {
    const seed = seedFrom(imageBase64);
    const count = 3 + (seed % 3);
    const start = seed % CATALOG.length;
    return Array.from({ length: count }, (_, i) => {
      const entry = CATALOG[(start + i) % CATALOG.length];
      return { ...entry, id: `stub-${i}` };
    });
  };
  return {
    detect,
    async detectBatch(framesBase64: readonly string[]): Promise<DetectedObject[]> {
      // Deterministic like detect(): seed from the first frame, tag frameIndex 0.
      const items = await detect(framesBase64[0] ?? '');
      return items.map((item) => ({ ...item, frameIndex: 0 }));
    },
  };
}
