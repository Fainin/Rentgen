/**
 * Stub adapters — deterministic mock data, zero network, zero keys.
 *
 * This is what the whole team builds against from hour 1 (spec §8). The app runs
 * end-to-end offline with these, so UI / total / widget work never blocks on the real
 * OpenAI / Tavily adapters landing. RentgenClient falls back to these whenever an API
 * key is missing (see config.ts).
 */

import type { DetectionAdapter, EnrichmentAdapter } from './types.js';
import type { DetectedObject, EnrichedItem, PriceRange, Source } from '../types.js';

const CURRENCY = 'EUR';

/** A small catalog of plausible "venue objects" so every offline scan produces a demo. */
const MOCK_OBJECTS: readonly Omit<DetectedObject, 'id'>[] = [
  { name: 'MacBook Pro 14"', category: 'Electronics', condition: 'used - good', confidence: 0.94 },
  { name: 'Sony WH-1000XM5 Headphones', category: 'Electronics', condition: 'used - like new', confidence: 0.88 },
  { name: 'Herman Miller Aeron Chair', category: 'Furniture', condition: 'used - fair', confidence: 0.82 },
  { name: 'DJI Mini 4 Pro Drone', category: 'Electronics', condition: 'used - good', confidence: 0.79 },
  { name: 'Fjällräven Kånken Backpack', category: 'Accessories', condition: 'used - good', confidence: 0.9 },
];

/** Cheap deterministic hash so mock prices are stable per object name (no Math.random). */
function seedFrom(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) >>> 0;
  }
  return h;
}

function mockResale(seed: number): PriceRange {
  const min = 60 + (seed % 900); // 60..959
  return { min, max: Math.round(min * 1.4), currency: CURRENCY };
}

function mockRentPerDay(resale: PriceRange): PriceRange {
  // Rough rule of thumb: ~3% of resale midpoint per day.
  const mid = (resale.min + resale.max) / 2;
  const min = Math.max(1, Math.round(mid * 0.02));
  const max = Math.max(min + 1, Math.round(mid * 0.04));
  return { min, max, currency: CURRENCY };
}

function mockSources(name: string): Source[] {
  const q = encodeURIComponent(name);
  return [
    { title: `${name} — eBay sold listings`, url: `https://www.ebay.de/sch/i.html?_nkw=${q}&LH_Sold=1` },
    { title: `${name} — Kleinanzeigen`, url: `https://www.kleinanzeigen.de/s-suchanfrage.html?keywords=${q}` },
  ];
}

export class StubDetectionAdapter implements DetectionAdapter {
  async detect(imageBase64: string): Promise<DetectedObject[]> {
    // Vary how many objects "appear" by the image so repeated scans feel alive, but
    // stay fully deterministic (no randomness — keeps rehearsal runs reproducible).
    const count = 3 + (seedFrom(imageBase64) % 3); // 3..5
    await delay(300); // fake a little latency so the loading state is visible
    return MOCK_OBJECTS.slice(0, count).map((o, i) => ({ ...o, id: `stub-${i}` }));
  }
}

export class StubEnrichmentAdapter implements EnrichmentAdapter {
  async enrich(object: DetectedObject): Promise<EnrichedItem> {
    await delay(200);
    const resale = mockResale(seedFrom(object.name));
    return {
      ...object,
      resale,
      rentPerDay: mockRentPerDay(resale),
      sources: mockSources(object.name),
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
