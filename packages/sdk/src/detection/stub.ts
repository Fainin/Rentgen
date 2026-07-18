/**
 * Offline DetectionAdapter — deterministic mock objects, no key, no network.
 * Lets the full chain (detect → enrich → total → render) run offline.
 * Real openai-vision (gpt-5.6-luna) lands in Workstream 2 behind the same interface.
 *
 * Includes one deliberately NON-sellable item ("Wall-mounted Radiator") so the
 * sellability gate in RentgenClient has something to drop — the honesty story,
 * visible live. Hero items mirror the pitch script (G7X, Soundboks, monitor, …).
 */
import type { DetectionAdapter } from '../adapters/types.js';
import type { DetectedObject } from '../types.js';

interface Fixture {
  readonly name: string;
  readonly category: string;
  readonly condition: string;
  readonly confidence: number;
}

const FIXTURE: readonly Fixture[] = [
  { name: 'Canon PowerShot G7X Mark II', category: 'Photography', condition: 'used - good', confidence: 0.92 },
  { name: 'Soundboks Gen 3', category: 'Audio', condition: 'used - good', confidence: 0.88 },
  { name: 'LG UltraWide 34" Monitor', category: 'Electronics', condition: 'used - good', confidence: 0.85 },
  { name: 'PlayStation 5 Controller', category: 'Gaming', condition: 'used - visible wear', confidence: 0.78 },
  { name: 'Bosch 18V Cordless Drill', category: 'Tools', condition: 'used - good', confidence: 0.81 },
  { name: 'Wall-mounted Radiator', category: 'Other', condition: 'used - good', confidence: 0.55 },
];

function toDetected(f: Fixture, index: number): DetectedObject {
  return {
    id: `oa-${index}`,
    name: f.name,
    category: f.category,
    condition: f.condition,
    confidence: f.confidence,
  };
}

export const stubDetectionAdapter: DetectionAdapter = {
  async detect(_imageBase64: string): Promise<DetectedObject[]> {
    return FIXTURE.map(toDetected);
  },
};
